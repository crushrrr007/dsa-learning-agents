from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_sheets, load_sheet
from app.db import get_db
from app.progress_service import get_or_create_progress
from app.schemas import SheetDetail, SheetProblemRow, SheetSummary

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

    rows: list[SheetProblemRow] = []
    mastered = 0
    for item in raw["problems"]:
        try:
            prog = await get_or_create_progress(db, session_id, item["id"], item["topic"])
            stage = max(prog.stage, 1)
            is_mastered = bool(prog.mastered)
        except Exception:
            stage = 0
            is_mastered = False
        if is_mastered:
            mastered += 1
        rows.append(
            SheetProblemRow(
                id=item["id"],
                title=item["title"],
                topic=item["topic"],
                difficulty=item["difficulty"],
                pattern=item["pattern"],
                pattern_id=item.get("pattern_id") or "",
                stage=stage,
                mastered=is_mastered,
            )
        )
    return SheetDetail(
        id=raw["id"],
        title=raw["title"],
        subtitle=raw.get("subtitle") or "",
        inspired_by=list(raw.get("inspired_by") or []),
        problems_total=len(rows),
        problems=rows,
        mastered_count=mastered,
    )
