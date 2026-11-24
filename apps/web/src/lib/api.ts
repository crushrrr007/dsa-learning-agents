import { getSessionId } from "./utils";

const API_BASE = "/lab-api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body: { detail?: unknown } | null = await res.json().catch(() => null);
      if (typeof body?.detail === "string") throw new Error(body.detail);
      throw new Error(res.status >= 500 ? "The lab service is unavailable. Try again shortly." : `Request failed (${res.status}).`);
    }
    return await (res.json() as Promise<T>);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("This took longer than expected. Try again in a moment.");
    }
    if (err instanceof TypeError) throw new Error("Could not connect to the lab. Check your connection and try again.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export type Topic = {
  slug: string;
  title: string;
  order: number;
  summary: string;
  color: string;
  phase?: number;
  learn_completed: boolean;
  problems_total: number;
  problems_mastered: number;
  has_plan?: boolean;
  next_problem_id?: string | null;
  plan_emphasis?: string | null;
  prerequisites?: string[];
};

export type Phase = {
  id: number;
  title: string;
  topic_slugs: string[];
};

export type Roadmap = {
  phase: number;
  title: string;
  description: string;
  topics: Topic[];
  phases?: Phase[];
};

export type ProblemSummary = {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  pattern: string;
  pattern_id?: string;
  sources?: string[];
  variant?: boolean;
  stage: number;
  mastered: boolean;
  plan_badge?: string | null;
  solved: boolean;
};

export type LearnerDashboard = {
  action: {
    kind: "lesson" | "resume" | "recommended" | "complete";
    title: string;
    reason: string;
    topic: string | null;
    problem_id: string | null;
    stage: number | null;
  };
  problems_total: number;
  problems_solved: number;
  problems_mastered: number;
  topics_total: number;
  patterns_total: number;
};

export type PatternInfo = {
  id: string;
  title: string;
  topics: string[];
  problems_total: number;
  problem_ids: string[];
};

export type RoadmapGraph = {
  session_id: string;
  nodes: {
    id: string;
    kind: string;
    label: string;
    slug?: string;
    pattern_id?: string;
    color?: string;
    status?: string;
    position: { x: number; y: number };
    problems_total?: number;
  }[];
  edges: { id: string; source: string; target: string; rel: string; style?: string }[];
  signals: Record<string, string[]>;
};

export type MicroReview = {
  skill: string;
  title: string;
  blurb: string;
  prereq_topic?: string;
  notes_anchor?: string;
};

export type TopicPlan = {
  topic: string;
  has_plan: boolean;
  overview_completed: boolean;
  plan: {
    summary?: string;
    review_notes?: string;
    emphasis?: string;
    prerequisites?: string[];
    review_first?: { id: string; title: string; difficulty: string; badge?: string }[];
    recommended?: { id: string; title: string; difficulty: string; badge?: string }[];
    optional?: { id: string; title: string; difficulty: string; badge?: string }[];
    next_problem_id?: string | null;
    micro_reviews?: MicroReview[];
  } | null;
};

export type ProblemDetail = Omit<ProblemSummary, "solved"> & {
  statement: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  starter_code: string;
  function_name: string;
  visual: string;
  predict_steps: { prompt: string; hint?: string }[];
  viva?: { question: string }[];
  last_code: string;
  next_predict_index: number;
  pattern_id?: string;
};

export type VivaQuestionResult = {
  index: number;
  passed: boolean;
  matched_points_count: number;
  feedback: string;
};

export type TraceEvent = {
  line: number;
  event: string;
  locals: Record<string, unknown>;
  focus: Record<string, unknown>;
};

export type RunResponse = {
  ok: boolean;
  result: unknown;
  error: string | null;
  events: TraceEvent[];
  stdout: string;
  duration_ms: number;
  stage: number;
  ast_insights: string[];
  performance: { n: number; ms: number; ok: boolean; error?: string }[];
};

export async function fetchLearnerDashboard() {
  return request<LearnerDashboard>(`/progress/dashboard?session_id=${encodeURIComponent(getSessionId())}`);
}

export async function fetchRoadmap() {
  const sid = getSessionId();
  return request<Roadmap>(`/topics/roadmap?session_id=${encodeURIComponent(sid)}`);
}

export async function fetchTopicLearn(slug: string) {
  const sid = getSessionId();
  return request<{
    slug: string;
    title: string;
    notes_markdown: string;
    quiz: { question: string; choices: string[] }[];
    learn_completed: boolean;
    demo_problem_id: string | null;
    demo_title: string | null;
    demo_visual: string | null;
  }>(`/topics/${slug}/learn?session_id=${encodeURIComponent(sid)}`);
}

export async function fetchDiagnostic(slug: string) {
  const sid = getSessionId();
  return request<{
    topic: string;
    title: string;
    prerequisites: string[];
    questions: { id: string; type: string; prompt: string; choices: string[] }[];
    has_plan: boolean;
    overview_completed: boolean;
  }>(`/topics/${slug}/diagnostic?session_id=${encodeURIComponent(sid)}`);
}

export async function submitDiagnostic(slug: string, answers: Record<string, string | number>) {
  return request<TopicPlan>(`/topics/${slug}/diagnostic`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), answers }),
  });
}

export async function fetchTopicPlan(slug: string) {
  const sid = getSessionId();
  return request<TopicPlan>(`/topics/${slug}/plan?session_id=${encodeURIComponent(sid)}`);
}

export async function fetchTopicOverview(slug: string) {
  const sid = getSessionId();
  return request<{
    topic: string;
    overview_markdown: string;
    guiding_question: string | null;
    source: string;
    overview_completed: boolean;
    plan: TopicPlan["plan"];
  }>(`/topics/${slug}/overview?session_id=${encodeURIComponent(sid)}`);
}

export async function completeTopicOverview(slug: string) {
  return request<TopicPlan>(`/topics/${slug}/overview/complete`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId() }),
  });
}

export async function runTopicDemo(slug: string) {
  return request<{
    topic: string;
    problem_id: string;
    title: string;
    visual: string;
    ok: boolean;
    result: unknown;
    error: string | null;
    events: TraceEvent[];
    duration_ms: number;
    explanation: string;
  }>(`/topics/${slug}/demo`, { method: "POST" });
}

export async function submitQuiz(topic: string, answers: number[]) {
  return request<{ passed: boolean; score: number; learn_completed: boolean }>(`/topics/quiz`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), topic, answers }),
  });
}

export async function fetchProblems(topic?: string, pattern?: string) {
  const sid = getSessionId();
  const q = [
    topic ? `topic=${encodeURIComponent(topic)}` : "",
    pattern ? `pattern=${encodeURIComponent(pattern)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const suffix = q ? `&${q}` : "";
  return request<ProblemSummary[]>(`/problems?session_id=${encodeURIComponent(sid)}${suffix}`);
}

export async function fetchPatterns() {
  return request<PatternInfo[]>(`/problems/patterns`);
}

export async function fetchRoadmapGraph() {
  const sid = getSessionId();
  return request<RoadmapGraph>(`/topics/roadmap/graph?session_id=${encodeURIComponent(sid)}`);
}

export async function fetchProblem(id: string) {
  const sid = getSessionId();
  return request<ProblemDetail>(`/problems/${id}?session_id=${encodeURIComponent(sid)}`);
}

export async function runCode(payload: {
  problem_id: string;
  code?: string;
  mode: "student" | "brute";
  args?: unknown[];
}) {
  return request<RunResponse>(`/run`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), ...payload }),
  });
}

export async function submitPredict(problemId: string, stepIndex: number, answer: string) {
  return request<{ correct: boolean; hint: string | null; stage: number; next_predict_index: number }>(`/predict`, {
    method: "POST",
    body: JSON.stringify({
      session_id: getSessionId(),
      problem_id: problemId,
      step_index: stepIndex,
      answer,
    }),
  });
}

export async function runTests(problemId: string, code: string) {
  return request<{
    passed_all: boolean;
    results: {
      index: number;
      passed: boolean;
      input: unknown;
      expected: unknown;
      got: unknown;
      error: string | null;
      visible?: boolean;
    }[];
    viva: { id: string; prompt: string }[];
    ast_insights: string[];
    stage: number;
    mastered: boolean;
  }>(`/test`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), problem_id: problemId, code }),
  });
}

export async function submitViva(problemId: string, answers: string[]) {
  return request<{
    passed: boolean;
    mastered?: boolean;
    detail?: string;
    stage?: number;
    results?: VivaQuestionResult[];
  }>(`/viva`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), problem_id: problemId, answers }),
  });
}

export async function fetchProgress() {
  const sid = getSessionId();
  return request<{
    session_id: string;
    problems: ProblemSummary[];
    topics: Topic[];
    phases?: Phase[];
  }>(`/progress?session_id=${encodeURIComponent(sid)}`);
}

export async function resetProgress() {
  return request<{
    ok: boolean;
    deleted: Record<string, number>;
    progress: { session_id: string; problems: ProblemSummary[]; topics: Topic[] };
  }>(`/progress/reset`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId() }),
  });
}

export async function chatAgent(payload: {
  problem_id?: string;
  topic?: string;
  stage: number;
  message: string;
  code?: string;
  last_run?: Record<string, unknown>;
  preferred_agent?: string;
}) {
  return request<{
    agent: string;
    agent_label: string | null;
    reply: string;
    guiding_question: string | null;
    llm_mode: string | null;
  }>(`/agents/chat`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), ...payload }),
  });
}
