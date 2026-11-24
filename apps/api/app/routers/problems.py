from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import get_problem, list_patterns, list_problems, public_problem
from app.db import get_db
from app.progress_service import build_problem_summaries, get_or_create_progress, next_prediction_index
from app.schemas import PatternOut, ProblemDetail, ProblemSummary

router = APIRouter(prefix="/problems", tags=["problems"])


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
    return await build_problem_summaries(db, session_id, list_problems(topic, pattern))


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
        next_predict_index=await next_prediction_index(db, row, len(pub["predict_steps"])),
    )
