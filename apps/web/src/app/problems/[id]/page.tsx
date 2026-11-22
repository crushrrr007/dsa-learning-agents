"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentDock } from "@/components/workspace/AgentDock";
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
  if (x === "easy") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (x === "hard") return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
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
  const [viva, setViva] = useState<{ id: string; prompt: string }[]>([]);
  const [vivaAnswers, setVivaAnswers] = useState<string[]>(["", ""]);
  const [vivaResults, setVivaResults] = useState<VivaQuestionResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("description");
  const [agentsOpen, setAgentsOpen] = useState(false);

  useEffect(() => {
    fetchProblem(id)
      .then((p) => {
        setProblem(p);
        setCode(p.last_code || p.starter_code);
        setStage(p.stage <= 0 ? 0 : Math.max(1, p.stage));
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
          setStage(Math.max(stage, res.stage, 3));
          setPredictMsg("All predictions passed. Editor unlocked for coding.");
        }
      } else {
        setPredictMsg(res.hint || "Not quite — try again.");
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
      setTestMsg(res.ok ? `Accepted (demo run) → ${JSON.stringify(res.result)}` : `Runtime error: ${res.error}`);
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
          ? `Accepted — ${passed}/${res.results.length} tests passed. Complete viva to master.`
          : `Wrong Answer — ${passed}/${res.results.length} passed.`,
      );
      if (res.passed_all) {
        setViva(res.viva);
        setVivaAnswers(res.viva.map(() => ""));
        setVivaResults([]);
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
      setTestMsg(res.passed ? "Mastered — viva accepted." : res.detail || "Viva incomplete");
      if (res.passed) setStage(4);
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Viva failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-[var(--muted)]">Loading problem…</div>;
  if (error && !problem) return <div className="p-8 text-red-700">{error}</div>;
  if (!problem) return null;

  const locked = stage < 3;
  const step = problem.predict_steps[predictIdx];

  return (
    <div className="flex h-[calc(100vh-3.25rem)] flex-col bg-[#f4f6f8]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-white px-3 py-2 sm:px-4">
        <Link href="/" className="text-xs font-semibold text-[var(--accent)] hover:underline">
          ← Problems
        </Link>
        <h1 className="text-base font-semibold sm:text-lg">{problem.title}</h1>
        <span className={`rounded border px-2 py-0.5 text-[11px] font-bold uppercase ${diffClass(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
        <Link
          href={`/?pattern=${encodeURIComponent(problem.pattern_id || "")}`}
          className="hidden rounded border border-[var(--line)] bg-[#f7faf8] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] hover:border-[var(--accent)] sm:inline"
        >
          {problem.pattern}
        </Link>
        <Link
          href={`/topics/${problem.topic}`}
          className="rounded bg-black/5 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--accent)]"
        >
          {problem.topic}
        </Link>
        {problem.mastered && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Mastered</span>
        )}
        <div className="ml-auto flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
          {["Learn", "See", "Predict", "Code", "Viva"].map((label, i) => (
            <span
              key={label}
              className={`rounded px-1.5 py-0.5 ${stage >= i ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-black/5"}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="border-b border-[var(--line)] bg-white px-4 py-1.5 text-xs text-[var(--muted)]">
        Tip: run the topic{" "}
        <Link href={`/topics/${problem.topic}`} className="font-semibold text-[var(--accent)] hover:underline">
          diagnostic → soft plan → overview
        </Link>{" "}
        anytime — problems stay openable.
      </div>

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[minmax(240px,0.95fr)_minmax(320px,1.2fr)_minmax(260px,0.9fr)]">
        {/* Left: description / path / trace */}
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
              <div className="space-y-4">
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
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">
                  NeetCode-style practice with staged unlocks — agents help; they never dump the full solution.
                </p>
                <div className="rounded-lg border border-[var(--line)] p-3">
                  <h3 className="font-semibold">1 · See</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">Watch the slow approach struggle.</p>
                  <Button className="mt-3" size="sm" onClick={onSee} disabled={busy || stage < 1}>
                    Run brute-force demo
                  </Button>
                </div>
                {step && (
                  <div className="rounded-lg border border-[var(--line)] p-3">
                    <h3 className="font-semibold">2 · Predict</h3>
                    <p className="mt-2 text-sm">{step.prompt}</p>
                    <input
                      value={predictAnswer}
                      onChange={(e) => setPredictAnswer(e.target.value)}
                      className="mt-3 h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                      placeholder="Your prediction"
                      disabled={stage < 2}
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <Button size="sm" onClick={onPredict} disabled={busy || stage < 2}>
                        Check
                      </Button>
                      {predictMsg && <span className="text-sm text-[var(--muted)]">{predictMsg}</span>}
                    </div>
                  </div>
                )}
                {viva.length > 0 && (
                  <div className="rounded-lg border border-[var(--line)] p-3">
                    <h3 className="font-semibold">4 · Viva</h3>
                    <div className="mt-3 space-y-3">
                      {viva.map((q, i) => {
                        const result = vivaResults.find((r) => r.index === i);
                        const locked = Boolean(result?.passed);
                        return (
                          <div key={q.id}>
                            <p className="text-sm font-medium">{q.prompt}</p>
                            <textarea
                              value={vivaAnswers[i] || ""}
                              onChange={(e) =>
                                setVivaAnswers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                              }
                              className="mt-2 w-full rounded-md border border-[var(--line)] bg-white p-2 text-sm disabled:bg-emerald-50"
                              rows={3}
                              disabled={locked || busy}
                              readOnly={locked}
                            />
                            {result && (
                              <p
                                className={`mt-1 text-xs ${
                                  result.passed ? "text-emerald-700" : "text-rose-700"
                                }`}
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
                  </div>
                )}
              </div>
            )}

            {leftTab === "trace" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>Trace frames</span>
                  <div className="flex gap-2">
                    <button type="button" className="underline" onClick={() => setPlaying((p) => !p)} disabled={!events.length}>
                      {playing ? "Pause" : "Play"}
                    </button>
                    <span>{events.length ? `${eventIdx + 1}/${events.length}` : "no frames — Run or demo first"}</span>
                  </div>
                </div>
                <div className="h-[360px] overflow-hidden rounded-md border border-[var(--line)]">
                  <VisualCanvas visual={problem.visual} event={currentEvent} />
                </div>
                {currentEvent && (
                  <pre className="overflow-x-auto rounded-md bg-[#0f1419] p-3 text-[11px] text-[#d7dee7]">
                    {JSON.stringify({ line: currentEvent.line, focus: currentEvent.focus, locals: currentEvent.locals }, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Center: editor + testcases */}
        <section className="flex min-h-0 flex-col border-r border-[var(--line)] bg-[#1e1e1e]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Editor</p>
              <span className="text-xs font-semibold text-white/70">Python3</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={onRun} disabled={busy || stage < 1}>
                Run
              </Button>
              <Button size="sm" onClick={onSubmit} disabled={busy || locked}>
                Submit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="lg:hidden"
                onClick={() => setAgentsOpen(true)}
              >
                Agents
              </Button>
            </div>
          </div>

          <div className="relative min-h-[240px] flex-1">
            {locked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-6 text-center backdrop-blur-[2px]">
                <div className="max-w-sm rounded-lg border border-white/15 bg-[#161b22] p-4 text-sm text-white">
                  <p className="font-semibold">Editor unlocks after Predict</p>
                  <p className="mt-2 text-white/70">
                    Finish See → Predict on the Learn path tab, or ask Hint / Demo in the agents panel.
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
                <p className="text-white/50">Run or Submit to see results here.</p>
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

        {/* Right: persistent agents (desktop) */}
        <aside className="hidden min-h-0 flex-col border-l border-[var(--line)] bg-[#0f1419] p-2 lg:flex">
          <AgentDock
            topic={problem.topic}
            problemId={problem.id}
            stage={stage}
            code={code}
            lastRun={
              run
                ? {
                    error: run.error,
                    result: run.result,
                    ast_insights: run.ast_insights,
                    events: run.events,
                    ok: run.ok,
                  }
                : null
            }
          />
        </aside>

        {/* Mobile agents drawer */}
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
                  lastRun={
                    run
                      ? {
                          error: run.error,
                          result: run.result,
                          ast_insights: run.ast_insights,
                          events: run.events,
                          ok: run.ok,
                        }
                      : null
                  }
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
