"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { AgentDock, type AgentId } from "@/components/workspace/AgentDock";
import {
  StageRail,
  WORKSPACE_STAGES,
  nextActionCopy,
  resolveActiveStage,
  type WorkspaceStageId,
} from "@/components/workspace/StageRail";
import {
  fetchProblem,
  runCode,
  runTests,
  submitPredict,
  submitViva,
  type ProblemDetail,
  type RunResponse,
  type TraceEvent,
  type VivaQuestionResult,
} from "@/lib/api";

function EditorLoading() {
  return <p role="status" className="px-4 py-3 text-sm text-[var(--surface)]/70">Loading Python editor…</p>;
}

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: EditorLoading });
const VisualCanvas = dynamic(
  () => import("@/components/workspace/VisualCanvas").then((m) => m.VisualCanvas),
  { ssr: false },
);

type LeftTab = "description" | "path" | "trace";

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (x === "hard") return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function agentForStage(active: WorkspaceStageId): AgentId {
  switch (active) {
    case "see":
      return "demo_coach";
    case "predict":
      return "predict_coach";
    case "code":
    case "test":
      return "code_mentor";
    case "viva":
      return "viva_agent";
    default:
      return "concept_tutor";
  }
}

export default function ProblemWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isValidating, mutate } = useSWR<ProblemDetail, Error>(
    ["workspace", id],
    () => fetchProblem(id),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false, dedupingInterval: 0 },
  );

  if (isValidating || (!data && !error)) {
    return <p role="status" className="px-6 py-16 text-center text-[var(--muted)]">Loading workspace…</p>;
  }
  if (error || !data) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-start gap-4 px-6 py-16" aria-labelledby="workspace-error">
        <h1 id="workspace-error" className="text-2xl font-semibold">Couldn&apos;t open this practice</h1>
        <p role="alert" className="text-[var(--muted)]">{error?.message}</p>
        <Button onClick={() => void mutate()}>Try again</Button>
        <Link href="/topics/two-pointers" className="text-sm font-semibold text-[var(--accent)] hover:underline">Back to the pilot</Link>
      </section>
    );
  }
  return <ProblemWorkspace key={data.id} problem={data} />;
}

function ProblemWorkspace({ problem }: { problem: ProblemDetail }) {
  const [mastered, setMastered] = useState(problem.mastered);
  const [stage, setStage] = useState(Math.max(1, problem.stage));
  const [code, setCode] = useState(problem.last_code || problem.starter_code);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [predictIdx, setPredictIdx] = useState(problem.next_predict_index);
  const [predictAnswer, setPredictAnswer] = useState("");
  const [predictMsg, setPredictMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    {
      index: number;
      passed: boolean;
      input: unknown;
      expected: unknown;
      got: unknown;
      error: string | null;
      visible?: boolean;
    }[]
  >([]);
  const [viva, setViva] = useState(() => problem.stage === 4 && !problem.mastered
    ? (problem.viva ?? []).map(({ question }, index) => ({ id: `q${index}`, prompt: question }))
    : []);
  const [vivaAnswers, setVivaAnswers] = useState<string[]>([]);
  const [vivaResults, setVivaResults] = useState<VivaQuestionResult[]>([]);
  const [vivaNotice, setVivaNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>(problem.stage === 3 ? "description" : "path");
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<WorkspaceStageId | null>(null);
  const predictionInput = useRef<HTMLInputElement>(null);
  const vivaHeading = useRef<HTMLHeadingElement>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const events: TraceEvent[] = run?.events || [];
  const currentEvent = events[eventIdx] || null;

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const t = setInterval(() => {
      setEventIdx((i) => {
        if (i >= events.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 450);
    return () => clearInterval(t);
  }, [playing, events.length]);

  const vivaReady = stage === 4 && viva.length > 0;
  const resolved = resolveActiveStage({ stage, vivaReady, mastered, hasTestResults: testResults.length > 0 });
  const uiStage = selectedStage ?? resolved;
  const action = nextActionCopy({ active: resolved, mastered });

  function clearViva() {
    setViva([]);
    setVivaAnswers([]);
    setVivaResults([]);
    setVivaNotice(null);
  }

  function onCodeChange(value?: string) {
    const next = value ?? "";
    if (next === code) return;
    setCode(next);
    if (stage === 4 && !mastered) {
      setStage(3);
      clearViva();
      setSelectedStage(null);
      setTestResults([]);
      setTestMsg("Code changed. Pass the tests again to unlock Viva.");
    }
  }

  async function onSee() {
    setBusy(true);
    setError(null);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "brute" });
      if (!res.ok) {
        setError("The demo couldn’t run. Try again before moving to Predict.");
        return;
      }
      setRun(res);
      setEventIdx(0);
      setPlaying(Boolean(res.events.length) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setStage(res.stage);
      setSelectedStage(null);
      setLeftTab("trace");
      setPredictMsg(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPredict() {
    if (!predictAnswer.trim() || busy) return;
    setBusy(true);
    setPredictMsg(null);
    try {
      const res = await submitPredict(problem.id, predictIdx, predictAnswer);
      if (res.correct) {
        setPredictIdx(res.next_predict_index);
        setPredictAnswer("");
        setStage(res.stage);
        setSelectedStage(null);
        if (res.stage >= 3) {
          setPredictMsg("All predictions passed — editor unlocked.");
          setLeftTab("description");
        } else {
          setPredictMsg("Correct. Try the next prediction.");
        }
      } else {
        setPredictMsg(res.hint || "Not quite — try again, or ask Predict in Agents.");
      }
    } catch (e) {
      setPredictMsg(e instanceof Error ? e.message : "Predict failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRun() {
    setBusy(true);
    setError(null);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "student", code });
      setRun(res);
      setEventIdx(0);
      setPlaying(Boolean(res.events.length) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setStage(res.stage);
      if (res.stage < 4) clearViva();
      else if (!mastered && !viva.length) {
        setViva((problem.viva ?? []).map(({ question }, index) => ({ id: `q${index}`, prompt: question })));
      }
      setTestMsg(res.ok ? `Demo returned ${JSON.stringify(res.result)}` : `Runtime error: ${res.error?.trim().split("\n").at(-1) || "The run did not complete."}`);
      if (res.events?.length) setLeftTab("trace");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setBusy(true);
    setError(null);
    setTestMsg("Checking your submission…");
    try {
      const res = await runTests(problem.id, code);
      setStage(res.stage);
      setTestResults(res.results);
      const passed = res.results.filter((r) => r.passed).length;
      setTestMsg(
        res.mastered
          ? `${passed}/${res.results.length} tests passed. Your mastery is already saved.`
          : res.passed_all
            ? `All ${res.results.length} tests passed. Viva is ready.`
            : `${passed}/${res.results.length} passed. Fix the failures and submit again to unlock Viva.`,
      );
      clearViva();
      setSelectedStage(null);
      if (res.passed_all && !res.mastered) {
        setViva(res.viva);
        setLeftTab("path");
      }
      setRun((prev) => ({
        ...(prev || {
          ok: res.passed_all,
          result: null,
          error: null,
          events: [],
          stdout: "",
          duration_ms: 0,
          stage: res.stage,
          performance: [],
          ast_insights: [],
        }),
        ast_insights: res.ast_insights,
      }));
    } catch (e) {
      setTestResults([]);
      setTestMsg(e instanceof Error ? e.message : "Submit failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onViva() {
    if (!vivaReady) return;
    setBusy(true);
    setVivaNotice("Checking your explanation…");
    try {
      const res = await submitViva(problem.id, viva.map((_, index) => vivaAnswers[index] ?? ""));
      setVivaResults(res.results || []);
      setVivaNotice(res.passed ? "Viva accepted. Mastery is saved." : res.detail || "Retry the questions that need more work.");
      if (res.passed) {
        setStage(res.stage ?? 4);
        setMastered(true);
        setSelectedStage(null);
      }
    } catch (e) {
      setVivaNotice(e instanceof Error ? e.message : "Viva submission failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSelectStage(id: WorkspaceStageId) {
    setSelectedStage(id);
    setLeftTab(id === "code" || id === "test" ? "description" : "path");
  }

  function onActionCta() {
    if (resolved === "see") {
      void onSee();
    } else if (resolved === "predict" || resolved === "viva") {
      onSelectStage(resolved);
      requestAnimationFrame(() => {
        if (resolved === "predict") predictionInput.current?.focus();
        else vivaHeading.current?.focus();
      });
    } else {
      onSelectStage(resolved);
      editorRef.current?.getDomNode()?.scrollIntoView({ block: "nearest" });
      editorRef.current?.focus();
    }
  }

  const locked = stage < 3;
  const step = problem.predict_steps[Math.min(predictIdx, problem.predict_steps.length - 1)];
  const stageMeta = WORKSPACE_STAGES.find((s) => s.id === resolved);

  const lastRun = run
    ? {
        error: run.error,
        result: run.result,
        ast_insights: run.ast_insights,
        events: run.events,
        ok: run.ok,
      }
    : null;

  return (
    <div className="flex flex-col bg-[var(--bg)] lg:h-[calc(100dvh-3.25rem)] lg:min-h-[620px]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/topics/${problem.topic}`} className="w-fit text-sm font-semibold capitalize text-[var(--accent)] hover:underline">
              ← {problem.topic.replace(/-/g, " ")}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance font-serif text-xl font-semibold sm:text-2xl">{problem.title}</h1>
              <span className={`rounded border px-2 py-0.5 text-xs font-semibold capitalize ${diffClass(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
            </div>
          </div>
          <StageRail stage={stage} active={uiStage} vivaReady={vivaReady} mastered={mastered} onSelect={onSelectStage} />
        </div>
      </header>

      <div
        className="border-b border-[var(--accent)]/20 bg-[var(--accent)]/[0.07] px-4 py-3 sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5" aria-live="polite">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              {mastered ? "Practice complete" : `Next step · ${stageMeta?.label ?? "Practice"}`}
            </p>
            <p className="text-base font-semibold text-[var(--ink)]">{action.title}</p>
            <p className="text-sm text-[var(--muted)]">{action.body}</p>
          </div>
          {mastered ? (
            <Link href="/progress" className="rounded-md border border-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10">View progress</Link>
          ) : action.cta && (
            <Button onClick={onActionCta} disabled={busy} className="shrink-0">{busy ? "Working…" : action.cta}</Button>
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-sm font-medium text-[var(--bad)]">{error}</p>}
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(240px,0.95fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)]">
        <section className="flex min-h-0 flex-col border-r border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-3 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Problem</p>
          </div>
          <div className="flex gap-1 border-b border-[var(--line)] px-2 pt-1">
            {(
              [
                ["description", "Description"],
                ["path", "Learn path"],
                ["trace", "Visual"],
              ] as const
            ).map(([idTab, label]) => (
              <button
                key={idTab}
                type="button"
                onClick={() => setLeftTab(idTab)}
                aria-pressed={leftTab === idTab}
                className={`rounded-t-md px-3 py-2 text-sm font-semibold ${
                  leftTab === idTab ? "bg-[#f4f6f8] text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {leftTab === "description" && (
              <div className="space-y-4 animate-rise">
                <p className="text-sm leading-relaxed text-[var(--ink)]">{problem.statement}</p>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Examples</h3>
                  <ul className="mt-2 space-y-2">
                    {problem.examples.map((ex, i) => (
                      <li key={i} className="rounded-md border border-[var(--line)] bg-[#f8faf9] px-3 py-2 font-mono text-xs">
                        <div>
                          <span className="font-sans font-semibold text-[var(--muted)]">Input: </span>
                          {ex.input}
                        </div>
                        <div className="mt-1">
                          <span className="font-sans font-semibold text-[var(--muted)]">Output: </span>
                          {ex.output}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {problem.constraints?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Constraints</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                      {problem.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {leftTab === "path" && (
              <div className="flex flex-col gap-4">
                {uiStage === "see" && (
                  <section className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">1 · See</h3>
                      {stage >= 2 && <span className="text-xs font-bold text-[var(--good)]">Done</span>}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">Watch the slow approach on the demo input.</p>
                    <Button className="mt-3" size="sm" onClick={onSee} disabled={busy}>
                      {busy ? "Running…" : "Run brute-force demo"}
                    </Button>
                  </section>
                )}

                {uiStage === "predict" && step && (
                  <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        2 · Predict{" "}
                        <span className="text-xs font-normal text-[var(--muted)]">
                          ({Math.min(predictIdx + 1, problem.predict_steps.length)}/{problem.predict_steps.length})
                        </span>
                      </h3>
                      {stage >= 3 && (
                        <span className="text-[10px] font-bold uppercase text-emerald-700">Done</span>
                      )}
                    </div>
                    {stage < 3 && (
                      <form className="mt-2 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void onPredict(); }}>
                        <label htmlFor="prediction-answer" className="text-sm font-medium">{step.prompt}</label>
                        <input
                          id="prediction-answer"
                          ref={predictionInput}
                          value={predictAnswer}
                          onChange={(event) => setPredictAnswer(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
                          }}
                          className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
                          placeholder="Your prediction"
                          disabled={stage < 2 || busy}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <Button type="submit" size="sm" disabled={busy || stage < 2 || !predictAnswer.trim()}>Check prediction</Button>
                          <p role="status" className="text-sm text-[var(--muted)]">{predictMsg}</p>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {(uiStage === "code" || uiStage === "test") && (
                  <section className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-4">
                    <h3 className="font-semibold">{uiStage === "code" ? "3 · Code" : "4 · Test"}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Use Run to check the demo. Submit must pass every case before Viva unlocks.
                    </p>
                  </section>
                )}

                {uiStage === "viva" && (vivaReady || mastered) && (
                  <div
                    className={`rounded-lg border p-3 ${
                      uiStage === "viva" ? "border-amber-400 bg-amber-50/80" : "border-[var(--line)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 ref={vivaHeading} tabIndex={-1} className="font-semibold">5 · Viva</h3>
                      {mastered && (
                        <span className="text-[10px] font-bold uppercase text-emerald-700">Mastered</span>
                      )}
                    </div>
                    {mastered ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">Mastery is saved for this guest session.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {viva.map((q, i) => {
                          const result = vivaResults.find((r) => r.index === i);
                          const qLocked = Boolean(result?.passed);
                          return (
                            <div key={q.id}>
                              <label htmlFor={`viva-answer-${i}`} className="text-sm font-medium">{q.prompt}</label>
                              <textarea
                                id={`viva-answer-${i}`}
                                value={vivaAnswers[i] ?? ""}
                                onChange={(event) =>
                                  setVivaAnswers((answers) => viva.map((_, index) => index === i ? event.target.value : answers[index] ?? ""))
                                }
                                className="mt-2 w-full rounded-md border border-[var(--line)] bg-white p-2 text-sm disabled:bg-emerald-50"
                                rows={3}
                                disabled={qLocked || busy}
                                readOnly={qLocked}
                              />
                              {result && (
                                <p
                                  className={`mt-1 text-xs ${result.passed ? "text-emerald-700" : "text-rose-700"}`}
                                >
                                  {result.passed ? "Passed" : "Retry this one"} — {result.feedback}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        <Button
                          size="sm"
                          onClick={onViva}
                          disabled={busy || viva.some((_, index) => !vivaAnswers[index]?.trim())}
                        >
                          {vivaResults.some((r) => !r.passed) ? "Retry failed questions" : "Submit Viva"}
                        </Button>
                        <p role="status" className="text-sm text-[var(--muted)]">{vivaNotice}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {leftTab === "trace" && (
              <div className="space-y-3 animate-rise">
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>Trace frames</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="underline disabled:opacity-40"
                      onClick={() => setPlaying((p) => !p)}
                      disabled={!events.length}
                    >
                      {playing ? "Pause" : "Play"}
                    </button>
                    <span>{events.length ? `${eventIdx + 1}/${events.length}` : "No frames — run demo or code first"}</span>
                  </div>
                </div>
                <div className="h-[360px] overflow-hidden rounded-md border border-[var(--line)]">
                  <VisualCanvas visual={problem.visual} event={currentEvent} />
                </div>
                {currentEvent && (
                  <pre className="overflow-x-auto rounded-md bg-[#0f1419] p-3 text-[11px] text-[#d7dee7]">
                    {JSON.stringify(
                      { line: currentEvent.line, focus: currentEvent.focus, locals: currentEvent.locals },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col border-r border-[var(--line)] bg-[#1e1e1e]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Editor</p>
              <span className="text-xs font-semibold text-white/70">Python3</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={onRun} disabled={busy || locked}>
                Run
              </Button>
              <Button size="sm" onClick={onSubmit} disabled={busy || locked}>
                Submit
              </Button>
              <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setAgentsOpen(true)}>
                Agents
              </Button>
            </div>
          </div>

          <div className="relative min-h-[240px] flex-1">
            {locked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-6 text-center backdrop-blur-[2px]">
                <div className="max-w-sm animate-rise rounded-lg border border-white/15 bg-[#161b22] p-4 text-sm text-white">
                  <p className="font-semibold">Editor unlocks after Predict</p>
                  <p className="mt-2 text-white/70">
                    Finish See → Predict on Learn path. Stuck? Ask Hint or Predict in Agents — not for the full answer.
                  </p>
                  <Button className="mt-3" size="sm" onClick={() => setLeftTab("path")}>
                    Open learn path
                  </Button>
                </div>
              </div>
            )}
            <Monaco
              height="100%"
              defaultLanguage="python"
              loading={<EditorLoading />}
              theme="vs-dark"
              value={code}
              onChange={onCodeChange}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                ariaLabel: "Python code editor",
                readOnly: locked || busy,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "ui-monospace, monospace",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          <div className="flex min-h-[180px] flex-[0.4] flex-col border-t border-white/10 bg-[#0f1419]">
            <div className="border-b border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">Testcases</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm text-[#d7dee7]">
              {testMsg && <p role="status" className="mb-3 font-medium text-white">{testMsg}</p>}
              {testResults.length === 0 && !testMsg && (
                <p className="text-white/70">Run checks the demo. Submit checks every case. Your code is saved when you run or submit.</p>
              )}
              <ul className="flex flex-col gap-2">
                {testResults.map((r) => (
                  <li
                    key={r.index}
                    className={`rounded border px-3 py-2 font-mono text-xs ${
                      r.passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"
                    }`}
                  >
                    <div className="font-sans font-semibold">
                      {r.passed ? "Passed" : "Failed"} ·{" "}
                      {r.visible ? `Example ${r.index + 1}` : r.index >= 2000 ? `Edge case ${r.index - 1999}` : `Hidden case ${r.index - 999}`}
                    </div>
                    {r.visible && (
                      <>
                        <div className="mt-1 opacity-80">in: {JSON.stringify(r.input)}</div>
                        <div className="opacity-80">expected: {JSON.stringify(r.expected)}</div>
                        <div className="opacity-80">got: {JSON.stringify(r.got)}</div>
                      </>
                    )}
                    {r.error && <div className="text-rose-300">{r.error}</div>}
                  </li>
                ))}
              </ul>
              {run?.ast_insights?.[0] && <p className="mt-3 text-xs text-white/50">AST: {run.ast_insights[0]}</p>}
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col border-l border-[var(--line)] bg-[#0f1419] p-2 lg:flex">
          <AgentDock
            topic={problem.topic}
            problemId={problem.id}
            stage={stage}
            code={code}
            lastRun={lastRun}
            defaultAgent={agentForStage(uiStage)}
            suggestedAgent={agentForStage(uiStage)}
          />
        </aside>

        {agentsOpen && (
          <div className="absolute inset-0 z-30 flex lg:hidden">
            <button
              type="button"
              className="flex-1 bg-black/50"
              aria-label="Close agents"
              onClick={() => setAgentsOpen(false)}
            />
            <div className="flex h-full w-[min(100%,380px)] flex-col bg-[#0f1419] p-2 shadow-2xl">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Agents</span>
                <Button size="sm" variant="secondary" onClick={() => setAgentsOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <AgentDock
                  topic={problem.topic}
                  problemId={problem.id}
                  stage={stage}
                  code={code}
                  lastRun={lastRun}
                  defaultAgent={agentForStage(uiStage)}
                  suggestedAgent={agentForStage(uiStage)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
