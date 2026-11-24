from __future__ import annotations

import json
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_patterns, list_problems, load_diagnostic, load_roadmap
from app.kg_service import clear_session_kg
from app.models import Attempt, Progress, TopicPlan, TopicProgress


async def get_or_create_progress(
    db: AsyncSession, session_id: str, problem_id: str, topic: str
) -> Progress:
    result = await db.execute(
        select(Progress).where(Progress.session_id == session_id, Progress.problem_id == problem_id)
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = Progress(session_id=session_id, problem_id=problem_id, topic=topic, stage=0)
    db.add(row)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        result = await db.execute(
            select(Progress).where(Progress.session_id == session_id, Progress.problem_id == problem_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
        raise
    await db.refresh(row)
    return row


async def find_topic_progress(db: AsyncSession, session_id: str, topic: str) -> TopicProgress | None:
    return await db.scalar(select(TopicProgress).where(
        TopicProgress.session_id == session_id, TopicProgress.topic == topic,
    ))


async def get_topic_progress(db: AsyncSession, session_id: str, topic: str) -> TopicProgress:
    row = await find_topic_progress(db, session_id, topic)
    if row:
        return row
    row = TopicProgress(session_id=session_id, topic=topic)
    db.add(row)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        result = await db.execute(
            select(TopicProgress).where(TopicProgress.session_id == session_id, TopicProgress.topic == topic)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
        raise
    await db.refresh(row)
    return row


async def next_prediction_index(db: AsyncSession, row: Progress, step_count: int) -> int:
    if row.stage >= 3:
        return step_count
    answers = set((await db.scalars(select(Attempt.detail).where(
        Attempt.session_id == row.session_id,
        Attempt.problem_id == row.problem_id,
        Attempt.stage == 2,
        Attempt.success == 1,
    ))).all())
    return next((i for i in range(step_count) if f"predict:{i}" not in answers), step_count)


async def mark_mastered(db: AsyncSession, session_id: str, problem_id: str, topic: str) -> Progress:
    row = await get_or_create_progress(db, session_id, problem_id, topic)
    row.mastered = 1
    row.stage = max(row.stage, 4)
    row.mastery_score = 1.0
    await db.commit()
    await db.refresh(row)
    return row


async def record_attempt(
    db: AsyncSession, session_id: str, problem_id: str, stage: int, success: bool, detail: str = ""
) -> None:
    db.add(
        Attempt(
            session_id=session_id,
            problem_id=problem_id,
            stage=stage,
            success=1 if success else 0,
            detail=detail[:2000],
        )
    )
    await db.commit()


async def learner_problem_rows(db: AsyncSession, session_id: str) -> dict[str, Progress]:
    rows = await db.scalars(select(Progress).where(Progress.session_id == session_id))
    return {row.problem_id: row for row in rows}


async def build_problem_summaries(
    db: AsyncSession, session_id: str, problems: list[dict], *, rows: dict[str, Progress] | None = None,
) -> list[dict]:
    if rows is None:
        rows = await learner_problem_rows(db, session_id)
    passing = set(await db.scalars(select(Attempt.problem_id).where(
        Attempt.session_id == session_id, Attempt.stage == 4, Attempt.success == 1,
    ).distinct()))
    plans = await db.scalars(select(TopicPlan).where(TopicPlan.session_id == session_id))
    badges: dict[str, str] = {}
    for plan_row in plans:
        plan = parse_plan_json(plan_row) or {}
        for group in ("optional", "recommended", "review_first"):
            for item in plan.get(group) or []:
                if item.get("id"):
                    badges[item["id"]] = item.get("badge") or group

    summaries = []
    for problem in problems:
        pid = problem["id"]
        row = rows.get(pid)
        stage = row.stage if row and row.stage >= 2 else 0
        mastered = bool(row and row.mastered)
        summaries.append({
            **{key: problem[key] for key in ("id", "title", "topic", "difficulty", "pattern", "pattern_id")},
            "sources": list(problem.get("sources") or []),
            "variant": bool(problem.get("variant", False)),
            "stage": stage,
            "mastered": mastered,
            "solved": mastered or stage >= 4 or pid in passing,
            "plan_badge": badges.get(pid),
        })
    return summaries


async def build_progress_snapshot(db: AsyncSession, session_id: str) -> dict:
    roadmap = load_roadmap()
    problem_summaries = await build_problem_summaries(db, session_id, list_problems())
    topic_rows = await db.scalars(select(TopicProgress).where(TopicProgress.session_id == session_id))
    by_topic = {row.topic: row for row in topic_rows}
    plans = await list_topic_plans_summary(db, session_id)

    topics_out = []
    for t in roadmap["topics"]:
        tp = by_topic.get(t["slug"])
        topic_problems = [x for x in problem_summaries if x["topic"] == t["slug"]]
        plan_meta = plans.get(t["slug"])
        topics_out.append(
            {
                **t,
                "phase": t.get("phase", 1),
                "prerequisites": load_diagnostic(t["slug"]).get("prerequisites", []),
                "learn_completed": bool(tp.learn_completed) if tp else False,
                "problems_total": len(topic_problems),
                "problems_mastered": sum(1 for x in topic_problems if x["mastered"]),
                "has_plan": bool(plan_meta),
                "next_problem_id": (plan_meta or {}).get("next_problem_id"),
                "plan_emphasis": (plan_meta or {}).get("emphasis"),
            }
        )

    return {
        "session_id": session_id,
        "problems": problem_summaries,
        "topics": topics_out,
        "phases": roadmap.get("phases", []),
        "plans": plans,
    }


async def build_learner_dashboard(db: AsyncSession, session_id: str) -> dict:
    topics = sorted(load_roadmap()["topics"], key=lambda topic: (topic.get("phase", 1), topic["order"]))
    progress = await learner_problem_rows(db, session_id)
    problems = await build_problem_summaries(db, session_id, list_problems(), rows=progress)
    by_id = {problem["id"]: problem for problem in problems}
    ready = await db.execute(select(Attempt.problem_id, func.max(Attempt.created_at)).where(
        Attempt.session_id == session_id,
    ).group_by(Attempt.problem_id))
    last_attempts = dict(ready.all())
    plans = (await db.scalars(select(TopicPlan).where(TopicPlan.session_id == session_id).order_by(
        TopicPlan.updated_at.desc(), TopicPlan.topic,
    ))).all()
    completed = set(await db.scalars(select(TopicProgress.topic).where(
        TopicProgress.session_id == session_id, TopicProgress.learn_completed == 1,
    )))

    def problem_action(kind: str, problem: dict, reason: str) -> dict:
        return {"kind": kind, "title": problem["title"], "reason": reason, "topic": problem["topic"],
                "problem_id": problem["id"], "stage": problem["stage"]}

    def next_action() -> dict:
        active = [p for p in problems if p["stage"] >= 2 and not p["mastered"]]
        if active:
            current = max(active, key=lambda p: (
                max(progress[p["id"]].updated_at, last_attempts.get(p["id"]) or progress[p["id"]].updated_at), p["id"],
            ))
            reason = {2: "You ran the demo. Pick up with the next prediction.",
                      3: "Your editor is unlocked. Continue coding and run the tests.",
                      4: "Your tests passed. Explain your approach in Viva to finish."}[current["stage"]]
            return problem_action("resume", current, reason)

        for row in plans:
            plan = parse_plan_json(row) or {}
            candidates = [plan.get("next_problem_id")] + [
                item.get("id") for group in ("review_first", "recommended") for item in (plan.get(group) or [])
            ]
            for pid in candidates:
                candidate = by_id.get(pid)
                if candidate and candidate["topic"] == row.topic and not candidate["mastered"]:
                    return problem_action("recommended", candidate, "This problem is next in your diagnostic plan.")

        for topic in topics:
            slug = topic["slug"]
            unfinished = [p for p in problems if p["topic"] == slug and not p["mastered"]]
            if not unfinished:
                continue
            if slug in completed or any(p["topic"] == slug and p["mastered"] for p in problems):
                ordered = sorted(unfinished, key=lambda p: ({"easy": 0, "medium": 1, "hard": 2}.get(p["difficulty"].lower(), 3), p["title"]))
                return problem_action("recommended", ordered[0], "Keep building confidence in your current chapter.")
            return {"kind": "lesson", "topic": slug, "title": topic["title"],
                    "reason": "Start with the next chapter in the Foundations path."}
        return {"kind": "complete", "title": "All chapters mastered", "reason": "Revisit a pattern in the practice library."}

    return {
        "action": next_action(), "problems_total": len(problems), "topics_total": len(topics),
        "patterns_total": len(list_patterns()), "problems_solved": sum(p["solved"] for p in problems),
        "problems_mastered": sum(p["mastered"] for p in problems),
    }


async def get_topic_plan(db: AsyncSession, session_id: str, topic: str) -> TopicPlan | None:
    result = await db.execute(
        select(TopicPlan).where(TopicPlan.session_id == session_id, TopicPlan.topic == topic)
    )
    return result.scalar_one_or_none()


async def upsert_topic_plan(
    db: AsyncSession,
    session_id: str,
    topic: str,
    *,
    answers: dict[str, Any],
    plan: dict[str, Any],
) -> TopicPlan:
    row = await get_topic_plan(db, session_id, topic)
    payload_answers = json.dumps(answers)
    payload_plan = json.dumps(plan)
    if row:
        row.diagnostic_answers = payload_answers
        row.plan_json = payload_plan
        # New diagnostic resets overview so teach step runs again
        row.overview_completed = 0
    else:
        row = TopicPlan(
            session_id=session_id,
            topic=topic,
            diagnostic_answers=payload_answers,
            plan_json=payload_plan,
            overview_completed=0,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def mark_overview_completed(db: AsyncSession, session_id: str, topic: str) -> TopicPlan | None:
    row = await get_topic_plan(db, session_id, topic)
    if not row:
        return None
    row.overview_completed = 1
    # Soft: also mark learn_completed so older UI fields stay coherent
    tp = await get_topic_progress(db, session_id, topic)
    tp.learn_completed = 1
    await db.commit()
    await db.refresh(row)
    return row


def parse_plan_json(row: TopicPlan | None) -> dict[str, Any] | None:
    if not row:
        return None
    try:
        return json.loads(row.plan_json or "{}")
    except json.JSONDecodeError:
        return {}


async def list_topic_plans_summary(db: AsyncSession, session_id: str) -> dict[str, dict[str, Any]]:
    rows = (await db.execute(select(TopicPlan).where(TopicPlan.session_id == session_id))).scalars().all()
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        plan = parse_plan_json(row) or {}
        out[row.topic] = {
            "topic": row.topic,
            "has_plan": True,
            "overview_completed": bool(row.overview_completed),
            "next_problem_id": plan.get("next_problem_id"),
            "emphasis": plan.get("emphasis"),
            "review_notes": plan.get("review_notes"),
        }
    return out


async def reset_session_progress(db: AsyncSession, session_id: str) -> dict[str, int]:
    prog = await db.execute(delete(Progress).where(Progress.session_id == session_id))
    topics = await db.execute(delete(TopicProgress).where(TopicProgress.session_id == session_id))
    attempts = await db.execute(delete(Attempt).where(Attempt.session_id == session_id))
    plans = await db.execute(delete(TopicPlan).where(TopicPlan.session_id == session_id))
    await db.commit()
    kg_deleted = 0
    try:
        kg_deleted = await clear_session_kg(db, session_id)
    except Exception:
        pass
    return {
        "progress_deleted": prog.rowcount or 0,
        "topics_deleted": topics.rowcount or 0,
        "attempts_deleted": attempts.rowcount or 0,
        "plans_deleted": plans.rowcount or 0,
        "kg_edges_deleted": kg_deleted,
    }
