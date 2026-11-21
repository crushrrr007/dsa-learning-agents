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
    stage: int = 0
    mastered: bool = False


class ProblemDetail(BaseModel):
    id: str
    title: str
    topic: str
    difficulty: str
    pattern: str
    statement: str
    examples: list[dict[str, Any]]
    constraints: list[str]
    starter_code: str
    function_name: str
    visual: str
    predict_steps: list[dict[str, Any]]
    stage: int = 0
    mastered: bool = False
    last_code: str = ""


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
    input: Any
    expected: Any
    got: Any = None
    error: str | None = None


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
