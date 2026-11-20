import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.content_loader import get_problem, list_problems, load_notes, load_roadmap, public_quiz, topic_quiz
from app.db import get_db
from app.progress_service import build_progress_snapshot, get_topic_progress
from app.runner.sandbox import run_student_code
from app.schemas import QuizResult, QuizSubmit, RoadmapOut, TopicDemoOut, TopicLearnOut

router = APIRouter(prefix="/topics", tags=["topics"])

TOPIC_DEMO_EXPLAIN = {
    "arrays": "Watch indices move as the demo rewrites the array in place.",
    "two-pointers": "Watch left and right pointers move toward each other on a real run.",
    "sliding-window": "Watch the window bounds slide while the running sum updates.",
    "linked-lists": "Watch node pointers rewire as the list is traversed or reversed.",
    "trees": "Watch recursion walk left/right children on a real binary tree.",
    "graphs": "Watch BFS/DFS expand across adjacency-list neighbors.",
    "dynamic-programming": "Watch the DP table fill from smaller states to larger ones.",
}


def _demo_args(problem: dict):
    demo = problem.get("demo_input")
    fn = problem["function_name"]
    if isinstance(demo, dict):
        if fn == "two_sum_sorted":
            return [demo["nums"], demo["target"]]
        if fn == "max_sum_subarray":
            return [demo["arr"], demo["k"]]
        if fn == "has_cycle":
            return [demo["values"], demo["pos"]]
        if fn == "shortest_path":
            return [demo["n"], demo["edges"], demo["src"], demo["dst"]]
        if fn == "count_components":
            return [demo["n"], demo["edges"]]
        return list(demo.values())
    return [demo]


@router.get("/roadmap", response_model=RoadmapOut)
async def roadmap(session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> RoadmapOut:
    data = load_roadmap()
    snap = await build_progress_snapshot(db, session_id)
    topics = snap["topics"]
    return RoadmapOut(
        phase=data["phase"],
        title=data["title"],
        description=data["description"],
        topics=topics,
        phases=data.get("phases", []),
    )


@router.get("/{slug}/learn", response_model=TopicLearnOut)
async def topic_learn(slug: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> TopicLearnOut:
    roadmap = load_roadmap()
    topic = next((t for t in roadmap["topics"] if t["slug"] == slug), None)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    tp = await get_topic_progress(db, session_id, slug)
    problems = list_problems(slug)
    preferred = {
        "arrays": "reverse-array",
        "two-pointers": "valid-palindrome",
        "sliding-window": "max-sum-subarray-k",
        "linked-lists": "reverse-linked-list",
        "trees": "max-depth-binary-tree",
        "graphs": "bfs-shortest-path",
        "dynamic-programming": "climb-stairs",
    }
    demo = next((p for p in problems if p["id"] == preferred.get(slug)), problems[0] if problems else None)
    return TopicLearnOut(
        slug=slug,
        title=topic["title"],
        notes_markdown=load_notes(slug),
        quiz=public_quiz(slug),
        learn_completed=bool(tp.learn_completed),
        demo_problem_id=demo["id"] if demo else None,
        demo_title=demo["title"] if demo else None,
        demo_visual=demo["visual"] if demo else None,
    )


@router.post("/{slug}/demo", response_model=TopicDemoOut)
async def topic_demo(slug: str) -> TopicDemoOut:
    problems = list_problems(slug)
    if not problems:
        raise HTTPException(status_code=404, detail="No demo for topic")
    # Prefer a representative problem with clear pointer motion
    preferred = {
        "arrays": "reverse-array",
        "two-pointers": "valid-palindrome",
        "sliding-window": "max-sum-subarray-k",
        "linked-lists": "reverse-linked-list",
        "trees": "max-depth-binary-tree",
        "graphs": "bfs-shortest-path",
        "dynamic-programming": "climb-stairs",
    }
    problem = next((p for p in problems if p["id"] == preferred.get(slug)), problems[0])
    # Load full problem (list_problems returns full dicts already)
    full = get_problem(problem["id"])
    started = time.perf_counter()
    raw = run_student_code(full["reference_solution"], full["function_name"], args=_demo_args(full))
    duration = (time.perf_counter() - started) * 1000
    return TopicDemoOut(
        topic=slug,
        problem_id=full["id"],
        title=full["title"],
        visual=full["visual"],
        ok=bool(raw.get("ok")),
        result=raw.get("result"),
        error=raw.get("error"),
        events=raw.get("events") or [],
        duration_ms=round(duration, 2),
        explanation=TOPIC_DEMO_EXPLAIN.get(slug, "Watch the traced demo for this topic."),
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
