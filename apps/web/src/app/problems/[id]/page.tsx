"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  completeSee,
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

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const VisualCanvas = dynamic(
  () => import("@/components/workspace/VisualCanvas").then((m) => m.VisualCanvas),
  { ssr: false },
);

type LeftTab = "description" | "path" | "trace";

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-300 bg-emerald-500/15 border-emerald-400/30";
  if (x === "hard") return "text-rose-300 bg-rose-500/15 border-rose-400/30";
  return "text-amber-300 bg-amber-500/15 border-amber-400/30";
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
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [stage, setStage] = useState(1);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [predictIdx, setPredictIdx] = useState(0);
  const [predictAnswer, setPredictAnswer] = useState("");
  const [predictMsg, setPredictMsg] = useState<string | null>(null);
  const [predictDone, setPredictDone] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testsPassed, setTestsPassed] = useState(false);
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
  const [viva, setViva] = useState<{ id: string; prompt: string }[]>([]);
  const [vivaAnswers, setVivaAnswers] = useState<string[]>(["", ""]);
  const [vivaResults, setVivaResults] = useState<VivaQuestionResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("path");
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [uiStage, setUiStage] = useState<WorkspaceStageId>("see");

  useEffect(() => {
    fetchProblem(id)
      .then((p) => {
        setProblem(p);
        setCode(p.last_code || p.starter_code);
        const s = p.stage <= 0 ? 1 : Math.max(1, p.stage);
        setStage(s);
        setPredictDone(s >= 3);
        const testsOk = Boolean(p.mastered) || s >= 4;
        setTestsPassed(testsOk);
        if (testsOk && (p.viva?.length || 0) > 0) {
          setViva(
            (p.viva || []).map((q, i) => ({
              id: `q${i}`,
              prompt: q.question,
            })),
          );
          setVivaAnswers((p.viva || []).map(() => ""));
          setVivaResults([]);
        }
        if (p.mastered || testsOk) setLeftTab("path");
        else if (s >= 3) setLeftTab("description");
        else setLeftTab("path");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  const resolved = useMemo(
    () =>
      resolveActiveStage({
        stage,
        testsPassed,
        vivaReady: viva.length > 0,
        mastered: Boolean(problem?.mastered),
      }),
    [stage, testsPassed, viva.length, problem?.mastered],
  );

  useEffect(() => {
    setUiStage(resolved);
  }, [resolved]);

  const action = nextActionCopy({
    active: uiStage,
    stage,
    testsPassed,
    vivaReady: viva.length > 0,
    mastered: Boolean(problem?.mastered),
    predictDone: predictDone || stage >= 3,
  });

  async function onSee() {
    if (!problem) return;
    setBusy(true);
    setTestMsg(null);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "brute" });
      setRun(res);
      setEventIdx(0);
      setPlaying(true);
      setLeftTab("trace");
      const adv = await completeSee(problem.id);
      setStage(Math.max(stage, adv.stage, 2));
      setUiStage("predict");
      setPredictMsg(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPredict() {
    if (!problem) return;
    setBusy(true);
    try {
      const res = await submitPredict(problem.id, predictIdx, predictAnswer);
      if (res.correct) {
        setPredictMsg("Correct.");
        if (predictIdx < problem.predict_steps.length - 1) {
          setPredictIdx((i) => i + 1);
          setPredictAnswer("");
        } else {
          setPredictDone(true);
          setStage(Math.max(stage, res.stage, 3));
          setPredictMsg("All predictions passed — editor unlocked.");
          setUiStage("code");
          setLeftTab("description");
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
    if (!problem) return;
    setBusy(true);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "student", code });
      setRun(res);
      setEventIdx(0);
      setPlaying(Boolean(res.events?.length));
      if (res.ok) setStage((s) => Math.max(s, 3));
      setTestMsg(res.ok ? `Demo run ok → ${JSON.stringify(res.result)}` : `Runtime error: ${res.error}`);
      if (res.events?.length) setLeftTab("trace");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!problem) return;
    setBusy(true);
    setTestMsg(null);
    try {
      const res = await runTests(problem.id, code);
      setStage(Math.max(stage, res.stage));
      setTestResults(res.results);
      const passed = res.results.filter((r) => r.passed).length;
      setTestMsg(
        res.passed_all
          ? `All ${res.results.length} tests passed. Complete viva to master.`
          : `${passed}/${res.results.length} passed — fix failures, then submit again. Viva stays locked.`,
      );
      setTestsPassed(Boolean(res.passed_all));
      if (res.passed_all) {
        setViva(res.viva);
        setVivaAnswers(res.viva.map(() => ""));
        setVivaResults([]);
        setLeftTab("path");
        setUiStage("viva");
      } else {
        setUiStage("test");
      }
      setRun((prev) => ({
        ...(prev || {
          ok: res.passed_all,
          result: null,
          error: null,
          events: [],
          stdout: "",
          duration_ms: 0,
          performance: [],
          ast_insights: [],
        }),
        ast_insights: res.ast_insights,
      }));
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function onViva() {
    if (!problem) return;
    setBusy(true);
    try {
      const res = await submitViva(problem.id, vivaAnswers);
      setVivaResults(res.results || []);
      setTestMsg(res.passed ? "Mastered — viva accepted." : res.detail || "Viva incomplete — retry failed questions.");
      if (res.passed) {
        setStage(4);
        setProblem((p) => (p ? { ...p, mastered: true } : p));
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Viva failed");
    } finally {
      setBusy(false);
    }
  }

  function onSelectStage(id: WorkspaceStageId) {
    setUiStage(id);
    if (id === "see" || id === "predict" || id === "viva") setLeftTab("path");
    if (id === "code" || id === "test") setLeftTab("description");
  }

  function onActionCta() {
    if (action.cta === "Run demo") {
      void onSee();
      return;
    }
    if (action.cta === "Go to predict" || action.cta === "Open viva") {
      setLeftTab("path");
      setUiStage(action.cta === "Open viva" ? "viva" : "predict");
      return;
    }
    if (action.cta === "Focus editor") {
      setUiStage("code");
      setLeftTab("description");
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.25rem)] items-center justify-center text-[var(--muted)]">
        <div className="animate-rise text-center">
          <p className="text-sm font-semibold">Loading workspace…</p>
          <p className="mt-1 text-xs">See → Predict → Code → Test → Viva</p>
        </div>
      </div>
    );
  }
  if (error && !problem) return <div className="p-8 text-red-700">{error}</div>;
  if (!problem) return null;

  const locked = stage < 3;
  const step = problem.predict_steps[predictIdx];
  const stageMeta = WORKSPACE_STAGES.find((s) => s.id === uiStage);

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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-[var(--ws-bg)] text-[var(--ws-text)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ws-line)] bg-[var(--ws-panel)] px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link
          href={`/topics/${problem.topic}`}
          className="text-xs font-semibold text-teal-300/90 hover:text-teal-200 hover:underline"
        >
          ← {problem.topic.replace(/-/g, " ")}
        </Link>
        <h1 className="text-base font-bold tracking-tight sm:text-lg">{problem.title}</h1>
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${diffClass(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
        {problem.mastered && (
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            Mastered
          </span>
        )}
        <div className="ml-auto hidden md:block">
          <StageRail
            tone="dark"
            stage={stage}
            active={uiStage}
            testsPassed={testsPassed}
            vivaReady={viva.length > 0}
            mastered={Boolean(problem.mastered)}
            onSelect={onSelectStage}
          />
        </div>
      </div>

      <div className="border-b border-[var(--ws-line)] bg-[var(--ws-panel)] px-3 py-2 md:hidden">
        <StageRail
          tone="dark"
          stage={stage}
          active={uiStage}
          testsPassed={testsPassed}
          vivaReady={viva.length > 0}
          mastered={Boolean(problem.mastered)}
          onSelect={onSelectStage}
        />
      </div>

      <div
        className={`flex flex-wrap items-center gap-3 border-b px-3 py-2.5 sm:px-4 ${
          problem.mastered
            ? "border-emerald-500/30 bg-emerald-500/10"
            : testsPassed || viva.length > 0
              ? "border-amber-400/30 bg-amber-400/10"
              : "border-teal-400/20 bg-teal-400/10"
        }`}
      >
        <div className="min-w-0 flex-1 animate-rise">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ws-muted)]">
            Next · {stageMeta?.label || "Stage"}
          </p>
          <p className="text-sm font-bold text-white">{action.title}</p>
          <p className="text-xs text-[var(--ws-muted)] sm:text-sm">{action.body}</p>
        </div>
        {action.cta && !problem.mastered && (
          <Button size="sm" onClick={onActionCta} disabled={busy} className="shrink-0 animate-pulse-soft">
            {busy ? "Working…" : action.cta}
          </Button>
        )}
      </div>

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[minmax(240px,0.95fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)]">
        <section className="flex min-h-0 flex-col border-r border-[var(--ws-line)] bg-[#0e1520]">
          <div className="border-b border-[var(--ws-line)] px-3 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ws-muted)]">Problem</p>
          </div>
          <div className="flex gap-1 border-b border-[var(--ws-line)] px-2 pt-1">
            {(
              [
                ["description", "Description"],
                ["path", "Stages"],
                ["trace", "Visual"],
              ] as const
            ).map(([idTab, label]) => (
              <button
                key={idTab}
                type="button"
                onClick={() => setLeftTab(idTab)}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  leftTab === idTab
                    ? "bg-[var(--ws-elevated)] text-white"
                    : "text-[var(--ws-muted)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {leftTab === "description" && (
              <div className="space-y-4 animate-rise">
                <p className="text-sm leading-relaxed text-[var(--ws-text)]">{problem.statement}</p>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ws-muted)]">Examples</h3>
                  <ul className="mt-2 space-y-2">
                    {problem.examples.map((ex, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-[var(--ws-line)] bg-[var(--ws-elevated)] px-3 py-2 font-mono text-xs text-[var(--ws-text)]"
                      >
                        <div>
                          <span className="font-sans font-semibold text-[var(--ws-muted)]">Input: </span>
                          {ex.input}
                        </div>
                        <div className="mt-1">
                          <span className="font-sans font-semibold text-[var(--ws-muted)]">Output: </span>
                          {ex.output}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {problem.constraints?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ws-muted)]">Constraints</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ws-muted)]">
                      {problem.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {leftTab === "path" && (
              <div className="space-y-4 animate-rise">
                <p className="text-sm text-[var(--ws-muted)]">
                  Finish each stage in order. Five coaches hint — they never paste a full solution.
                </p>

                <div
                  className={`rounded-xl border p-3 ${
                    uiStage === "see"
                      ? "border-teal-400/40 bg-teal-400/10"
                      : "border-[var(--ws-line)] bg-[var(--ws-elevated)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-white">1 · See</h3>
                    {stage >= 2 && <span className="text-[10px] font-bold uppercase text-emerald-300">Done</span>}
                  </div>
                  <p className="mt-1 text-sm text-[var(--ws-muted)]">Watch the slow approach struggle on a demo input.</p>
                  <Button className="mt-3" size="sm" onClick={onSee} disabled={busy}>
                    {busy && uiStage === "see" ? "Running…" : "Run brute-force demo"}
                  </Button>
                </div>

                {step && (
                  <div
                    className={`rounded-xl border p-3 ${
                      uiStage === "predict"
                        ? "border-teal-400/40 bg-teal-400/10"
                        : "border-[var(--ws-line)] bg-[var(--ws-elevated)]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">
                        2 · Predict{" "}
                        <span className="text-xs font-normal text-[var(--ws-muted)]">
                          ({Math.min(predictIdx + 1, problem.predict_steps.length)}/{problem.predict_steps.length})
                        </span>
                      </h3>
                      {(predictDone || stage >= 3) && (
                        <span className="text-[10px] font-bold uppercase text-emerald-300">Done</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--ws-text)]">{step.prompt}</p>
                    <input
                      value={predictAnswer}
                      onChange={(e) => setPredictAnswer(e.target.value)}
                      className="mt-3 h-10 w-full rounded-lg border border-[var(--ws-line)] bg-[#0b0f14] px-3 text-sm text-white outline-none focus:border-teal-400/50"
                      placeholder="Your prediction"
                      disabled={stage < 2 || predictDone || stage >= 3}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button size="sm" onClick={onPredict} disabled={busy || stage < 2 || predictDone || stage >= 3}>
                        Check
                      </Button>
                      {predictMsg && <span className="text-sm text-[var(--ws-muted)]">{predictMsg}</span>}
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-xl border p-3 ${
                    uiStage === "code" || uiStage === "test"
                      ? "border-teal-400/40 bg-teal-400/10"
                      : "border-[var(--ws-line)] bg-[var(--ws-elevated)]/50"
                  }`}
                >
                  <h3 className="font-semibold text-white">3 · Code &amp; Test</h3>
                  <p className="mt-1 text-sm text-[var(--ws-muted)]">
                    {locked
                      ? "Editor unlocks after Predict. Use Run for a quick check, Submit for full tests."
                      : "Submit must pass every case before viva unlocks. Failed submits keep you here."}
                  </p>
                </div>

                {(viva.length > 0 || problem.mastered) && (
                  <div
                    className={`rounded-xl border p-3 ${
                      uiStage === "viva"
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-[var(--ws-line)] bg-[var(--ws-elevated)]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">4 · Viva</h3>
                      {problem.mastered && (
                        <span className="text-[10px] font-bold uppercase text-emerald-300">Mastered</span>
                      )}
                    </div>
                    {viva.length === 0 && problem.mastered ? (
                      <p className="mt-2 text-sm text-[var(--ws-muted)]">Already mastered on this session.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {viva.map((q, i) => {
                          const result = vivaResults.find((r) => r.index === i);
                          const qLocked = Boolean(result?.passed);
                          return (
                            <div key={q.id}>
                              <p className="text-sm font-medium text-[var(--ws-text)]">{q.prompt}</p>
                              <textarea
                                value={vivaAnswers[i] || ""}
                                onChange={(e) =>
                                  setVivaAnswers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                                }
                                className="mt-2 w-full rounded-lg border border-[var(--ws-line)] bg-[#0b0f14] p-2 text-sm text-white outline-none focus:border-teal-400/50 disabled:bg-emerald-500/10"
                                rows={3}
                                disabled={qLocked || busy}
                                readOnly={qLocked}
                              />
                              {result && (
                                <p
                                  className={`mt-1 text-xs ${result.passed ? "text-emerald-300" : "text-rose-300"}`}
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
                          disabled={busy || (vivaResults.length > 0 && vivaResults.every((r) => r.passed))}
                        >
                          {vivaResults.some((r) => !r.passed) ? "Retry failed questions" : "Submit viva"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {leftTab === "trace" && (
              <div className="space-y-3 animate-rise">
                <div className="flex items-center justify-between text-xs text-[var(--ws-muted)]">
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
                <div className="h-[360px] overflow-hidden rounded-xl border border-[var(--ws-line)] bg-white">
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

        <section className="flex min-h-0 flex-col border-r border-[var(--ws-line)] bg-[#0d1117]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ws-line)] px-3 py-2">
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
                    Open stages
                  </Button>
                </div>
              </div>
            )}
            <Monaco
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v || "")}
              options={{
                readOnly: locked,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "IBM Plex Mono, ui-monospace, monospace",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          <div className="flex min-h-[180px] flex-[0.4] flex-col border-t border-white/10 bg-[#0f1419]">
            <div className="border-b border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">Testcases</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm text-[#d7dee7]">
              {testMsg && <p className="mb-3 font-medium text-white">{testMsg}</p>}
              {testResults.length === 0 && !testMsg && (
                <p className="text-white/50">Run for a quick check. Submit for examples + hidden tests.</p>
              )}
              <ul className="space-y-2">
                {testResults.map((r) => (
                  <li
                    key={r.index}
                    className={`rounded border px-3 py-2 font-mono text-xs ${
                      r.passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"
                    }`}
                  >
                    <div className="font-sans font-semibold">
                      {r.passed ? "Passed" : "Failed"} ·{" "}
                      {r.visible ? `Example ${r.index + 1}` : `Hidden case ${r.index}`}
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

        <aside className="hidden min-h-0 flex-col border-l border-[var(--ws-line)] bg-[var(--ws-bg)] p-2 lg:flex">
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
      {error && problem && <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
