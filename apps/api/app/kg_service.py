"""SQLite knowledge graph: curriculum seed + per-session learning edges."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_patterns, list_problems, load_roadmap, slugify_pattern
from app.models import KgEdge, KgNode

_SEEDED = False


def topic_node_id(slug: str) -> str:
    return f"topic:{slug}"


def pattern_node_id(pid: str) -> str:
    return f"pattern:{pid}"


def problem_node_id(pid: str) -> str:
    return f"problem:{pid}"


def skill_node_id(skill: str) -> str:
    return f"skill:{slugify_pattern(skill)}"


async def upsert_node(db: AsyncSession, node_id: str, kind: str, label: str, meta: dict | None = None) -> None:
    row = await db.get(KgNode, node_id)
    payload = json.dumps(meta or {})
    if row:
        row.kind = kind
        row.label = label
        row.meta_json = payload
    else:
        db.add(KgNode(id=node_id, kind=kind, label=label, meta_json=payload))


async def upsert_edge(
    db: AsyncSession,
    src: str,
    dst: str,
    rel: str,
    *,
    session_id: str = "",
    weight: float = 1.0,
    meta: dict | None = None,
) -> None:
    result = await db.execute(
        select(KgEdge).where(
            KgEdge.src == src,
            KgEdge.dst == dst,
            KgEdge.rel == rel,
            KgEdge.session_id == session_id,
        )
    )
    row = result.scalar_one_or_none()
    payload = json.dumps(meta or {})
    if row:
        row.weight = weight
        row.meta_json = payload
    else:
        db.add(
            KgEdge(
                src=src,
                dst=dst,
                rel=rel,
                weight=weight,
                session_id=session_id,
                meta_json=payload,
            )
        )


async def seed_curriculum_graph(db: AsyncSession) -> None:
    """Idempotent content → KG seed (session_id='')."""
    global _SEEDED
    roadmap = load_roadmap()
    for t in roadmap.get("topics", []):
        slug = t["slug"]
        await upsert_node(
            db,
            topic_node_id(slug),
            "topic",
            t.get("title") or slug,
            {"color": t.get("color"), "order": t.get("order"), "summary": t.get("summary")},
        )

    for pat in list_patterns():
        await upsert_node(
            db,
            pattern_node_id(pat["id"]),
            "pattern",
            pat["title"],
            {"topics": pat["topics"], "problems_total": pat["problems_total"]},
        )
        for topic in pat["topics"]:
            await upsert_edge(db, topic_node_id(topic), pattern_node_id(pat["id"]), "teaches", weight=1.0)

    problems = list_problems()
    # order topics for requires edges between consecutive topics
    topic_order = [t["slug"] for t in sorted(roadmap.get("topics", []), key=lambda x: x.get("order", 0))]
    for i in range(1, len(topic_order)):
        await upsert_edge(
            db,
            topic_node_id(topic_order[i]),
            topic_node_id(topic_order[i - 1]),
            "requires",
            weight=1.0,
        )

    for p in problems:
        await upsert_node(
            db,
            problem_node_id(p["id"]),
            "problem",
            p["title"],
            {
                "topic": p["topic"],
                "difficulty": p["difficulty"],
                "pattern_id": p.get("pattern_id"),
            },
        )
        await upsert_edge(db, topic_node_id(p["topic"]), problem_node_id(p["id"]), "contains", weight=1.0)
        pid = p.get("pattern_id")
        if pid:
            await upsert_edge(db, pattern_node_id(pid), problem_node_id(p["id"]), "instance_of", weight=1.0)

    await db.commit()
    _SEEDED = True


async def ensure_seeded(db: AsyncSession) -> None:
    global _SEEDED
    if _SEEDED:
        return
    count = (await db.execute(select(KgNode).limit(1))).scalar_one_or_none()
    if count is None:
        await seed_curriculum_graph(db)
    else:
        _SEEDED = True


async def record_diagnostic_kg(
    db: AsyncSession,
    session_id: str,
    topic: str,
    plan: dict[str, Any],
) -> None:
    await ensure_seeded(db)
    analysis = plan.get("diagnostic_analysis") or {}
    for skill in analysis.get("skills_weak") or []:
        sid = skill_node_id(skill)
        await upsert_node(db, sid, "skill", skill.replace("-", " ").title(), {"topic": topic})
        await upsert_edge(
            db,
            topic_node_id(topic),
            sid,
            "weak_on",
            session_id=session_id,
            weight=1.5,
            meta={"source": "diagnostic"},
        )
    for item in plan.get("micro_reviews") or []:
        skill = item.get("skill") or ""
        if not skill:
            continue
        sid = skill_node_id(skill)
        await upsert_node(db, sid, "skill", item.get("title") or skill, {"topic": topic})
        await upsert_edge(
            db,
            topic_node_id(topic),
            sid,
            "weak_on",
            session_id=session_id,
            weight=1.2,
            meta={"blurb": item.get("blurb")},
        )
    next_id = plan.get("next_problem_id")
    if next_id:
        await upsert_edge(
            db,
            topic_node_id(topic),
            problem_node_id(next_id),
            "recommended",
            session_id=session_id,
            weight=2.0,
        )
    for bucket in ("review_first", "recommended"):
        for item in plan.get(bucket) or []:
            pid = item.get("id")
            if not pid:
                continue
            await upsert_edge(
                db,
                topic_node_id(topic),
                problem_node_id(pid),
                "recommended",
                session_id=session_id,
                weight=1.5 if bucket == "review_first" else 1.0,
            )
            pat = item.get("badge")
            # also recommend pattern via problem's pattern if we can load it
            try:
                from app.content_loader import get_problem

                prob = get_problem(pid)
                pattern = prob.get("pattern_id")
                if pattern:
                    await upsert_edge(
                        db,
                        topic_node_id(topic),
                        pattern_node_id(pattern),
                        "recommended",
                        session_id=session_id,
                        weight=1.0,
                    )
            except KeyError:
                pass
    await db.commit()


async def record_attempt_kg(
    db: AsyncSession,
    session_id: str,
    problem_id: str,
    *,
    success: bool,
    topic: str | None = None,
) -> None:
    await ensure_seeded(db)
    try:
        from app.content_loader import get_problem

        prob = get_problem(problem_id)
        topic = topic or prob["topic"]
        pattern = prob.get("pattern_id")
    except KeyError:
        pattern = None
        topic = topic or ""
    await upsert_edge(
        db,
        f"session:{session_id}",
        problem_node_id(problem_id),
        "attempted",
        session_id=session_id,
        weight=1.0 if success else 0.5,
        meta={"ok": success},
    )
    # ensure session node exists lightly
    await upsert_node(db, f"session:{session_id}", "session_fact", f"Session {session_id[:8]}", {})
    if not success and pattern:
        await upsert_edge(
            db,
            topic_node_id(topic) if topic else f"session:{session_id}",
            pattern_node_id(pattern),
            "weak_on",
            session_id=session_id,
            weight=1.0,
            meta={"from": "failed_attempt", "problem_id": problem_id},
        )
    await db.commit()


async def record_mastered_kg(db: AsyncSession, session_id: str, problem_id: str) -> None:
    await ensure_seeded(db)
    try:
        from app.content_loader import get_problem

        prob = get_problem(problem_id)
        pattern = prob.get("pattern_id")
        topic = prob["topic"]
    except KeyError:
        return
    await upsert_edge(
        db,
        f"session:{session_id}",
        problem_node_id(problem_id),
        "mastered",
        session_id=session_id,
        weight=2.0,
    )
    if pattern:
        await upsert_edge(
            db,
            f"session:{session_id}",
            pattern_node_id(pattern),
            "mastered",
            session_id=session_id,
            weight=1.5,
        )
    await upsert_edge(
        db,
        f"session:{session_id}",
        topic_node_id(topic),
        "mastered",
        session_id=session_id,
        weight=1.0,
        meta={"partial": True, "problem_id": problem_id},
    )
    await db.commit()


async def session_signals(db: AsyncSession, session_id: str, topic: str | None = None) -> dict[str, Any]:
    """Compact weak/mastered/recommended sets for planners and agents."""
    await ensure_seeded(db)
    result = await db.execute(select(KgEdge).where(KgEdge.session_id == session_id))
    edges = result.scalars().all()
    weak_skills: list[str] = []
    weak_patterns: list[str] = []
    mastered_problems: list[str] = []
    mastered_patterns: list[str] = []
    recommended_problems: list[str] = []
    for e in edges:
        if topic and e.src == topic_node_id(topic) and e.rel == "weak_on" and e.dst.startswith("skill:"):
            weak_skills.append(e.dst.split(":", 1)[1])
        if e.rel == "weak_on" and e.dst.startswith("pattern:"):
            weak_patterns.append(e.dst.split(":", 1)[1])
        if e.rel == "mastered" and e.dst.startswith("problem:"):
            mastered_problems.append(e.dst.split(":", 1)[1])
        if e.rel == "mastered" and e.dst.startswith("pattern:"):
            mastered_patterns.append(e.dst.split(":", 1)[1])
        if e.rel == "recommended" and e.dst.startswith("problem:"):
            if not topic or e.src == topic_node_id(topic):
                recommended_problems.append(e.dst.split(":", 1)[1])
    return {
        "weak_skills": sorted(set(weak_skills)),
        "weak_patterns": sorted(set(weak_patterns)),
        "mastered_problems": sorted(set(mastered_problems)),
        "mastered_patterns": sorted(set(mastered_patterns)),
        "recommended_problems": sorted(set(recommended_problems)),
    }


async def build_roadmap_graph(db: AsyncSession, session_id: str) -> dict[str, Any]:
    await ensure_seeded(db)
    roadmap = load_roadmap()
    topics = sorted(roadmap.get("topics", []), key=lambda t: t.get("order", 0))
    patterns = list(list_patterns())
    signals = await session_signals(db, session_id)

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    # layout: topics on a row, patterns below their topics
    for i, t in enumerate(topics):
        slug = t["slug"]
        x = i * 220
        y = 40
        status = "default"
        if any(True for p in list_problems(slug) if p["id"] in signals["mastered_problems"]):
            status = "progress"
        if slug in {p.split("-")[0] for p in signals["weak_patterns"]}:
            pass
        nodes.append(
            {
                "id": topic_node_id(slug),
                "kind": "topic",
                "label": t.get("title") or slug,
                "slug": slug,
                "color": t.get("color") or "#0b6e5f",
                "status": status,
                "position": {"x": x, "y": y},
            }
        )
        if i > 0:
            edges.append(
                {
                    "id": f"req-{topics[i-1]['slug']}-{slug}",
                    "source": topic_node_id(topics[i - 1]["slug"]),
                    "target": topic_node_id(slug),
                    "rel": "sequence",
                    "style": "solid",
                }
            )

    # pattern nodes clustered under first topic that teaches them
    pat_index: dict[str, int] = {}
    for pat in patterns:
        topics_for = pat["topics"] or ["arrays"]
        primary = topics_for[0]
        ti = next((i for i, t in enumerate(topics) if t["slug"] == primary), 0)
        idx = pat_index.get(primary, 0)
        pat_index[primary] = idx + 1
        status = "default"
        if pat["id"] in signals["mastered_patterns"]:
            status = "mastered"
        elif pat["id"] in signals["weak_patterns"]:
            status = "weak"
        elif any(pid in signals["recommended_problems"] for pid in pat["problem_ids"]):
            status = "recommended"
        nodes.append(
            {
                "id": pattern_node_id(pat["id"]),
                "kind": "pattern",
                "label": pat["title"],
                "pattern_id": pat["id"],
                "topics": topics_for,
                "problems_total": pat["problems_total"],
                "status": status,
                "position": {"x": ti * 220 + (idx % 2) * 40, "y": 160 + (idx // 1) * 70},
            }
        )
        for top in topics_for:
            style = "solid"
            if status == "recommended":
                style = "dashed"
            if status == "weak":
                style = "weak"
            if status == "mastered":
                style = "mastered"
            edges.append(
                {
                    "id": f"teach-{top}-{pat['id']}",
                    "source": topic_node_id(top),
                    "target": pattern_node_id(pat["id"]),
                    "rel": "teaches",
                    "style": style,
                }
            )

    return {
        "session_id": session_id,
        "nodes": nodes,
        "edges": edges,
        "signals": signals,
    }


async def clear_session_kg(db: AsyncSession, session_id: str) -> int:
    res = await db.execute(delete(KgEdge).where(KgEdge.session_id == session_id))
    # remove session fact node
    await db.execute(delete(KgNode).where(KgNode.id == f"session:{session_id}"))
    await db.commit()
    return res.rowcount or 0
