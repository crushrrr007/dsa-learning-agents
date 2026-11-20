from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_problems, load_roadmap
from app.models import Attempt, Progress, TopicProgress


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

    topics_out = []
    for t in roadmap["topics"]:
        tp = by_topic.get(t["slug"])
        topic_problems = [x for x in problem_summaries if x["topic"] == t["slug"]]
        topics_out.append(
            {
                **t,
                "phase": t.get("phase", 1),
                "learn_completed": bool(tp.learn_completed) if tp else False,
                "problems_total": len(topic_problems),
                "problems_mastered": sum(1 for x in topic_problems if x["mastered"]),
            }
        )

    return {
        "session_id": session_id,
        "problems": problem_summaries,
        "topics": topics_out,
        "phases": roadmap.get("phases", []),
    }
