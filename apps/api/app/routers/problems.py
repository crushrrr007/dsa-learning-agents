from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import get_problem, list_patterns, list_problems, public_problem
from app.db import get_db
from app.progress_service import get_or_create_progress, get_topic_plan, parse_plan_json
from app.schemas import PatternOut, ProblemDetail, ProblemSummary

router = APIRouter(prefix="/problems", tags=["problems"])


def _badge_map(plan: dict | None) -> dict[str, str]:
    if not plan:
        return {}
    out: dict[str, str] = {}
    for key in ("review_first", "recommended", "optional"):
        for item in plan.get(key) or []:
            pid = item.get("id")
            if pid:
                out[pid] = item.get("badge") or key
    return out


@router.get("/patterns", response_model=list[PatternOut])
async def patterns():
    return [PatternOut(**p) for p in list_patterns()]


@router.get("", response_model=list[ProblemSummary])
async def problems(
    topic: str | None = None,
    pattern: str | None = None,
    session_id: str = "guest",
    db: AsyncSession = Depends(get_db),
):
    items = list_problems(topic, pattern)
    plan_row = await get_topic_plan(db, session_id, topic) if topic else None
    badges = _badge_map(parse_plan_json(plan_row))
    if not topic:
        badges = {}
        seen: set[str] = set()
        for p in items:
            if p["topic"] in seen:
                continue
            seen.add(p["topic"])
            row = await get_topic_plan(db, session_id, p["topic"])
            badges.update(_badge_map(parse_plan_json(row)))

    out: list[ProblemSummary] = []
    for p in items:
        try:
            row = await get_or_create_progress(db, session_id, p["id"], p["topic"])
            stage = max(row.stage, 1)
            out.append(
                ProblemSummary(
                    id=p["id"],
                    title=p["title"],
                    topic=p["topic"],
                    difficulty=p["difficulty"],
                    pattern=p["pattern"],
                    pattern_id=p.get("pattern_id") or "",
                    stage=stage,
                    mastered=bool(row.mastered),
                    plan_badge=badges.get(p["id"]),
                )
            )
        except Exception:
            out.append(
                ProblemSummary(
                    id=p["id"],
                    title=p["title"],
                    topic=p["topic"],
                    difficulty=p["difficulty"],
                    pattern=p["pattern"],
                    pattern_id=p.get("pattern_id") or "",
                    plan_badge=badges.get(p["id"]),
                )
            )
    return out


@router.get("/{problem_id}", response_model=ProblemDetail)
async def problem_detail(problem_id: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)):
    try:
        problem = get_problem(problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Problem not found") from exc
    pub = public_problem(problem)
    row = await get_or_create_progress(db, session_id, problem_id, problem["topic"])
    stage = max(row.stage, 1)
    if row.stage < 1:
        row.stage = 1
        await db.commit()
    return ProblemDetail(
        **pub,
        stage=stage,
        mastered=bool(row.mastered),
        last_code=row.last_code or problem["starter_code"],
    )
