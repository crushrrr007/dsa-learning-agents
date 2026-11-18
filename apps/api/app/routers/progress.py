from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.progress_service import build_progress_snapshot
from app.schemas import ProgressOut

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressOut)
async def progress(session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> ProgressOut:
    snap = await build_progress_snapshot(db, session_id)
    return ProgressOut(**snap)
