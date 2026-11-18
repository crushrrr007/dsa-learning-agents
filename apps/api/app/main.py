from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.notes_store import _collection
from app.config import get_settings
from app.db import init_db
from app.routers import agents, problems, progress, run, topics


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    # Seed Chroma notes (best-effort)
    try:
        _collection()
    except Exception:
        pass
    yield


settings = get_settings()
app = FastAPI(title="DSA Multi-Agent Learning Platform", version="0.1.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router)
app.include_router(problems.router)
app.include_router(run.router)
app.include_router(agents.router)
app.include_router(progress.router)


@app.get("/health")
async def health():
    return {"ok": True, "service": "dsa-api"}
