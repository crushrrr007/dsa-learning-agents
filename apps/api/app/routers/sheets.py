from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_sheets, load_sheet
from app.db import get_db
from app.progress_service import build_problem_summaries
from app.schemas import SheetDetail, SheetSummary

router = APIRouter(prefix="/sheets", tags=["sheets"])


@router.get("", response_model=list[SheetSummary])
async def sheets():
    return [SheetSummary(**s) for s in list_sheets()]


@router.get("/{sheet_id}", response_model=SheetDetail)
async def sheet_detail(sheet_id: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)):
    try:
        raw = load_sheet(sheet_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Sheet not found") from exc

    rows = await build_problem_summaries(db, session_id, raw["problems"])
    return SheetDetail(
        id=raw["id"],
        title=raw["title"],
        subtitle=raw.get("subtitle") or "",
        inspired_by=list(raw.get("inspired_by") or []),
        problems_total=len(rows),
        problems=rows,
        mastered_count=sum(row["mastered"] for row in rows),
    )
