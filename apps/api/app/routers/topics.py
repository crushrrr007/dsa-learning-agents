from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import list_problems, load_notes, load_roadmap, public_quiz, topic_quiz
from app.db import get_db
from app.progress_service import build_progress_snapshot, get_topic_progress
from app.schemas import QuizResult, QuizSubmit, RoadmapOut, TopicLearnOut

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("/roadmap", response_model=RoadmapOut)
async def roadmap(session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> RoadmapOut:
    data = load_roadmap()
    snap = await build_progress_snapshot(db, session_id)
    topics = snap["topics"]
    return RoadmapOut(phase=data["phase"], title=data["title"], description=data["description"], topics=topics)


@router.get("/{slug}/learn", response_model=TopicLearnOut)
async def topic_learn(slug: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> TopicLearnOut:
    roadmap = load_roadmap()
    topic = next((t for t in roadmap["topics"] if t["slug"] == slug), None)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    tp = await get_topic_progress(db, session_id, slug)
    problems = list_problems(slug)
    demo_id = problems[0]["id"] if problems else None
    return TopicLearnOut(
        slug=slug,
        title=topic["title"],
        notes_markdown=load_notes(slug),
        quiz=public_quiz(slug),
        learn_completed=bool(tp.learn_completed),
        demo_problem_id=demo_id,
    )


@router.post("/quiz", response_model=QuizResult)
async def submit_quiz(body: QuizSubmit, db: AsyncSession = Depends(get_db)) -> QuizResult:
    quiz = topic_quiz(body.topic)
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz for topic")
    correct = 0
    for idx, q in enumerate(quiz):
        if idx < len(body.answers) and body.answers[idx] == q["answer_index"]:
            correct += 1
    score = correct / len(quiz)
    passed = score >= 0.66
    tp = await get_topic_progress(db, body.session_id, body.topic)
    tp.quiz_score = score
    if passed:
        tp.learn_completed = 1
    await db.commit()
    return QuizResult(passed=passed, score=score, learn_completed=bool(tp.learn_completed))
