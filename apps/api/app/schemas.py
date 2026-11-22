from typing import Any

from pydantic import BaseModel, Field


class TopicOut(BaseModel):
    slug: str
    title: str
    order: int
    summary: str
    color: str
    phase: int = 1
    learn_completed: bool = False
    problems_total: int = 0
    problems_mastered: int = 0
    has_plan: bool = False
    next_problem_id: str | None = None
    plan_emphasis: str | None = None


class PhaseOut(BaseModel):
    id: int
    title: str
    topic_slugs: list[str] = Field(default_factory=list)


class RoadmapOut(BaseModel):
    phase: int
    title: str
    description: str
    topics: list[TopicOut]
    phases: list[PhaseOut] = Field(default_factory=list)


class ProblemSummary(BaseModel):
    id: str
    title: str
    topic: str
    difficulty: str
    pattern: str
    pattern_id: str = ""
    sources: list[str] = Field(default_factory=list)
    variant: bool = False
    stage: int = 0
    mastered: bool = False
    plan_badge: str | None = None


class ProblemDetail(BaseModel):
    id: str
    title: str
    topic: str
    difficulty: str
    pattern: str
    pattern_id: str = ""
    statement: str
    examples: list[dict[str, Any]]
    constraints: list[str]
    starter_code: str
    function_name: str
    visual: str
    predict_steps: list[dict[str, Any]]
    sources: list[str] = Field(default_factory=list)
    variant: bool = False
    viva: list[dict[str, Any]] = Field(default_factory=list)
    stage: int = 0
    mastered: bool = False
    last_code: str = ""


class PatternOut(BaseModel):
    id: str
    title: str
    topics: list[str] = Field(default_factory=list)
    problems_total: int = 0
    problem_ids: list[str] = Field(default_factory=list)


class RoadmapGraphOut(BaseModel):
    session_id: str
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    signals: dict[str, Any] = Field(default_factory=dict)


class TopicLearnOut(BaseModel):
    slug: str
    title: str
    notes_markdown: str
    quiz: list[dict[str, Any]]
    learn_completed: bool = False
    demo_problem_id: str | None = None
    demo_title: str | None = None
    demo_visual: str | None = None


class TopicDemoOut(BaseModel):
    topic: str
    problem_id: str
    title: str
    visual: str
    ok: bool
    result: Any = None
    error: str | None = None
    events: list[dict[str, Any]] = Field(default_factory=list)
    duration_ms: float = 0.0
    explanation: str = ""


class RunRequest(BaseModel):
    session_id: str
    problem_id: str
    code: str | None = None
    mode: str = Field(description="student | brute | reference_hidden")
    args: list[Any] | None = None


class TraceEvent(BaseModel):
    line: int
    event: str
    locals: dict[str, Any] = Field(default_factory=dict)
    focus: dict[str, Any] = Field(default_factory=dict)


class RunResponse(BaseModel):
    ok: bool
    result: Any = None
    error: str | None = None
    events: list[TraceEvent] = Field(default_factory=list)
    stdout: str = ""
    duration_ms: float = 0.0
    ast_insights: list[str] = Field(default_factory=list)
    performance: list[dict[str, Any]] = Field(default_factory=list)


class PredictRequest(BaseModel):
    session_id: str
    problem_id: str
    step_index: int
    answer: str


class PredictResponse(BaseModel):
    correct: bool
    hint: str | None = None
    stage: int


class QuizSubmit(BaseModel):
    session_id: str
    topic: str
    answers: list[int]


class QuizResult(BaseModel):
    passed: bool
    score: float
    learn_completed: bool


class StageAdvanceRequest(BaseModel):
    session_id: str
    problem_id: str
    stage: int


class ProgressOut(BaseModel):
    session_id: str
    problems: list[ProblemSummary]
    topics: list[TopicOut]
    phases: list[PhaseOut] = Field(default_factory=list)


class TestRequest(BaseModel):
    session_id: str
    problem_id: str
    code: str


class TestCaseResult(BaseModel):
    index: int
    passed: bool
    input: Any = None
    expected: Any = None
    got: Any = None
    error: str | None = None
    visible: bool = False


class TestResponse(BaseModel):
    passed_all: bool
    results: list[TestCaseResult]
    viva: list[dict[str, str]] = Field(default_factory=list)
    ast_insights: list[str] = Field(default_factory=list)
    stage: int = 0
    mastered: bool = False


class VivaSubmit(BaseModel):
    session_id: str
    problem_id: str
    answers: list[str]


class VivaQuestionResult(BaseModel):
    index: int
    passed: bool
    matched_points_count: int = 0
    feedback: str = ""


class VivaResponse(BaseModel):
    passed: bool
    mastered: bool = False
    stage: int = 0
    detail: str | None = None
    results: list[VivaQuestionResult] = Field(default_factory=list)


class AgentChatRequest(BaseModel):
    session_id: str
    problem_id: str | None = None
    topic: str | None = None
    stage: int = 0
    message: str
    code: str | None = None
    last_run: dict[str, Any] | None = None
    preferred_agent: str | None = None


class AgentChatResponse(BaseModel):
    agent: str
    agent_label: str | None = None
    reply: str
    guiding_question: str | None = None
    llm_mode: str | None = None


class DiagnosticQuestionOut(BaseModel):
    id: str
    type: str
    prompt: str
    choices: list[str] = Field(default_factory=list)


class DiagnosticOut(BaseModel):
    topic: str
    title: str
    prerequisites: list[str] = Field(default_factory=list)
    questions: list[DiagnosticQuestionOut] = Field(default_factory=list)
    has_plan: bool = False
    overview_completed: bool = False


class DiagnosticSubmit(BaseModel):
    session_id: str
    answers: dict[str, Any]


class TopicPlanOut(BaseModel):
    topic: str
    has_plan: bool = False
    overview_completed: bool = False
    plan: dict[str, Any] | None = None


class OverviewOut(BaseModel):
    topic: str
    overview_markdown: str
    guiding_question: str | None = None
    source: str = "notes"
    overview_completed: bool = False
    plan: dict[str, Any] | None = None


class OverviewComplete(BaseModel):
    session_id: str
