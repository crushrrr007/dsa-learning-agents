from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Progress(Base):
    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("session_id", "problem_id", name="uq_session_problem"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    problem_id: Mapped[str] = mapped_column(String(64), index=True)
    topic: Mapped[str] = mapped_column(String(64), default="")
    stage: Mapped[int] = mapped_column(Integer, default=0)
    mastered: Mapped[int] = mapped_column(Integer, default=0)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)
    last_code: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class TopicProgress(Base):
    __tablename__ = "topic_progress"
    __table_args__ = (UniqueConstraint("session_id", "topic", name="uq_session_topic"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    topic: Mapped[str] = mapped_column(String(64), index=True)
    learn_completed: Mapped[int] = mapped_column(Integer, default=0)
    quiz_score: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    problem_id: Mapped[str] = mapped_column(String(64), index=True)
    stage: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class TopicPlan(Base):
    __tablename__ = "topic_plans"
    __table_args__ = (UniqueConstraint("session_id", "topic", name="uq_session_topic_plan"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    topic: Mapped[str] = mapped_column(String(64), index=True)
    diagnostic_answers: Mapped[str] = mapped_column(Text, default="{}")
    plan_json: Mapped[str] = mapped_column(Text, default="{}")
    overview_completed: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class KgNode(Base):
    __tablename__ = "kg_nodes"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)  # topic|pattern|problem|skill
    label: Mapped[str] = mapped_column(String(256), default="")
    meta_json: Mapped[str] = mapped_column(Text, default="{}")


class KgEdge(Base):
    __tablename__ = "kg_edges"
    __table_args__ = (
        UniqueConstraint("src", "dst", "rel", "session_id", name="uq_kg_edge"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src: Mapped[str] = mapped_column(String(128), index=True)
    dst: Mapped[str] = mapped_column(String(128), index=True)
    rel: Mapped[str] = mapped_column(String(32), index=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    session_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)
