from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.progress_service import build_progress_snapshot, reset_session_progress
from app.schemas import ProgressOut

router = APIRouter(prefix="/progress", tags=["progress"])


class ResetRequest(BaseModel):
    session_id: str


@router.get("", response_model=ProgressOut)
async def progress(session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> ProgressOut:
    snap = await build_progress_snapshot(db, session_id)
    return ProgressOut(**snap)


@router.post("/reset")
async def reset_progress(body: ResetRequest, db: AsyncSession = Depends(get_db)):
    deleted = await reset_session_progress(db, body.session_id)
    snap = await build_progress_snapshot(db, body.session_id)
    return {"ok": True, "deleted": deleted, "progress": snap}
