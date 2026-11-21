from __future__ import annotations

import json
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_problems, load_roadmap
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


async def get_topic_progress(db: AsyncSession, session_id: str, topic: str) -> TopicProgress:
    result = await db.execute(
        select(TopicProgress).where(TopicProgress.session_id == session_id, TopicProgress.topic == topic)
    )
    row = result.scalar_one_or_none()
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


async def set_stage(db: AsyncSession, session_id: str, problem_id: str, topic: str, stage: int) -> Progress:
    row = await get_or_create_progress(db, session_id, problem_id, topic)
    row.stage = max(row.stage, stage)
    await db.commit()
    await db.refresh(row)
    return row


async def save_code(db: AsyncSession, session_id: str, problem_id: str, topic: str, code: str) -> None:
    row = await get_or_create_progress(db, session_id, problem_id, topic)
    row.last_code = code
    await db.commit()


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


async def build_progress_snapshot(db: AsyncSession, session_id: str) -> dict:
    roadmap = load_roadmap()
    problems = list_problems()
    prog_rows = (
        await db.execute(select(Progress).where(Progress.session_id == session_id))
    ).scalars().all()
    topic_rows = (
        await db.execute(select(TopicProgress).where(TopicProgress.session_id == session_id))
    ).scalars().all()
    by_problem = {p.problem_id: p for p in prog_rows}
    by_topic = {t.topic: t for t in topic_rows}

    problem_summaries = []
    for p in problems:
        row = by_problem.get(p["id"])
        problem_summaries.append(
            {
                "id": p["id"],
                "title": p["title"],
                "topic": p["topic"],
                "difficulty": p["difficulty"],
                "pattern": p["pattern"],
                "stage": row.stage if row else 0,
                "mastered": bool(row.mastered) if row else False,
            }
        )

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
    return {
        "progress_deleted": prog.rowcount or 0,
        "topics_deleted": topics.rowcount or 0,
        "attempts_deleted": attempts.rowcount or 0,
        "plans_deleted": plans.rowcount or 0,
    }
