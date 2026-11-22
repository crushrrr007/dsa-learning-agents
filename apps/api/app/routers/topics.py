import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.topic_pipeline import run_diagnostic_to_plan, teach_overview
from app.content_loader import (
    get_problem,
    list_problems,
    load_notes,
    load_roadmap,
    public_diagnostic,
    public_quiz,
    topic_quiz,
)
from app.db import get_db
from app.kg_service import build_roadmap_graph, record_diagnostic_kg
from app.progress_service import (
    build_progress_snapshot,
    get_topic_plan,
    get_topic_progress,
    mark_overview_completed,
    parse_plan_json,
    upsert_topic_plan,
)
from app.runner.sandbox import run_student_code
from app.schemas import (
    DiagnosticOut,
    DiagnosticSubmit,
    OverviewComplete,
    OverviewOut,
    QuizResult,
    QuizSubmit,
    RoadmapGraphOut,
    RoadmapOut,
    TopicDemoOut,
    TopicLearnOut,
    TopicPlanOut,
)

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
        if fn == "min_subarray_len":
            return [demo["nums"], demo["k"]]
        if fn == "is_same_tree":
            return [demo["a"], demo["b"]]
        return list(demo.values())
    return [demo]


@router.get("/roadmap", response_model=RoadmapOut)
async def roadmap(session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> RoadmapOut:
    data = load_roadmap()
    snap = await build_progress_snapshot(db, session_id)
    topics = snap["topics"]
    return RoadmapOut(
        phase=data.get("phase", 0),
        title=data["title"],
        description=data["description"],
        topics=topics,
        phases=[],  # phases removed from product UI
    )


@router.get("/roadmap/graph", response_model=RoadmapGraphOut)
async def roadmap_graph(session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> RoadmapGraphOut:
    graph = await build_roadmap_graph(db, session_id)
    return RoadmapGraphOut(**graph)


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


@router.get("/{slug}/diagnostic", response_model=DiagnosticOut)
async def get_diagnostic(slug: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> DiagnosticOut:
    roadmap = load_roadmap()
    if not any(t["slug"] == slug for t in roadmap["topics"]):
        raise HTTPException(status_code=404, detail="Topic not found")
    pub = public_diagnostic(slug)
    row = await get_topic_plan(db, session_id, slug)
    return DiagnosticOut(
        topic=pub["topic"],
        title=pub["title"],
        prerequisites=pub["prerequisites"],
        questions=pub["questions"],
        has_plan=bool(row),
        overview_completed=bool(row.overview_completed) if row else False,
    )


@router.post("/{slug}/diagnostic", response_model=TopicPlanOut)
async def submit_diagnostic(
    slug: str, body: DiagnosticSubmit, db: AsyncSession = Depends(get_db)
) -> TopicPlanOut:
    roadmap = load_roadmap()
    if not any(t["slug"] == slug for t in roadmap["topics"]):
        raise HTTPException(status_code=404, detail="Topic not found")
    plan = await run_diagnostic_to_plan(slug, body.answers or {}, session_id=body.session_id, db=db)
    row = await upsert_topic_plan(db, body.session_id, slug, answers=body.answers or {}, plan=plan)
    try:
        await record_diagnostic_kg(db, body.session_id, slug, plan)
    except Exception:
        pass
    return TopicPlanOut(
        topic=slug,
        has_plan=True,
        overview_completed=bool(row.overview_completed),
        plan=plan,
    )


@router.get("/{slug}/plan", response_model=TopicPlanOut)
async def get_plan(slug: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> TopicPlanOut:
    row = await get_topic_plan(db, session_id, slug)
    return TopicPlanOut(
        topic=slug,
        has_plan=bool(row),
        overview_completed=bool(row.overview_completed) if row else False,
        plan=parse_plan_json(row),
    )


@router.get("/{slug}/overview", response_model=OverviewOut)
async def get_overview(slug: str, session_id: str = "guest", db: AsyncSession = Depends(get_db)) -> OverviewOut:
    roadmap = load_roadmap()
    if not any(t["slug"] == slug for t in roadmap["topics"]):
        raise HTTPException(status_code=404, detail="Topic not found")
    row = await get_topic_plan(db, session_id, slug)
    plan = parse_plan_json(row)
    taught = await teach_overview(slug, plan)
    return OverviewOut(
        topic=slug,
        overview_markdown=taught["overview_markdown"],
        guiding_question=taught.get("guiding_question"),
        source=taught.get("source", "notes"),
        overview_completed=bool(row.overview_completed) if row else False,
        plan=plan,
    )


@router.post("/{slug}/overview/complete", response_model=TopicPlanOut)
async def complete_overview(
    slug: str, body: OverviewComplete, db: AsyncSession = Depends(get_db)
) -> TopicPlanOut:
    row = await mark_overview_completed(db, body.session_id, slug)
    if not row:
        raise HTTPException(status_code=404, detail="No plan for topic — complete diagnostic first")
    return TopicPlanOut(
        topic=slug,
        has_plan=True,
        overview_completed=True,
        plan=parse_plan_json(row),
    )
