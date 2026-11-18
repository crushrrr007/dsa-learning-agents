import { getSessionId } from "./utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8417";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type Topic = {
  slug: string;
  title: string;
  order: number;
  summary: string;
  color: string;
  learn_completed: boolean;
  problems_total: number;
  problems_mastered: number;
};

export type Roadmap = {
  phase: number;
  title: string;
  description: string;
  topics: Topic[];
};

export type ProblemSummary = {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  pattern: string;
  stage: number;
  mastered: boolean;
};

export type ProblemDetail = ProblemSummary & {
  statement: string;
  examples: { input: string; output: string }[];
  constraints: string[];
  starter_code: string;
  function_name: string;
  visual: string;
  predict_steps: { prompt: string; hint?: string }[];
  last_code: string;
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
  ast_insights: string[];
  performance: { n: number; ms: number; ok: boolean; error?: string }[];
};

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
  }>(`/topics/${slug}/learn?session_id=${encodeURIComponent(sid)}`);
}

export async function submitQuiz(topic: string, answers: number[]) {
  return request<{ passed: boolean; score: number; learn_completed: boolean }>(`/topics/quiz`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), topic, answers }),
  });
}

export async function fetchProblems(topic?: string) {
  const sid = getSessionId();
  const q = topic ? `&topic=${encodeURIComponent(topic)}` : "";
  return request<ProblemSummary[]>(`/problems?session_id=${encodeURIComponent(sid)}${q}`);
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

export async function completeSee(problemId: string) {
  const sid = getSessionId();
  return request<{ stage: number }>(
    `/stage/see?session_id=${encodeURIComponent(sid)}&problem_id=${encodeURIComponent(problemId)}`,
    { method: "POST" },
  );
}

export async function submitPredict(problemId: string, stepIndex: number, answer: string) {
  return request<{ correct: boolean; hint: string | null; stage: number }>(`/predict`, {
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
  return request<{ passed: boolean; mastered?: boolean; detail?: string; stage?: number }>(`/viva`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), problem_id: problemId, answers }),
  });
}

export async function chatAgent(payload: {
  problem_id?: string;
  topic?: string;
  stage: number;
  message: string;
  code?: string;
  last_run?: Record<string, unknown>;
}) {
  return request<{ agent: string; reply: string; guiding_question: string | null }>(`/agents/chat`, {
    method: "POST",
    body: JSON.stringify({ session_id: getSessionId(), ...payload }),
  });
}
