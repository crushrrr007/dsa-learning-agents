"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentPanel } from "@/components/workspace/AgentPanel";
import { StageRail } from "@/components/workspace/StageRail";
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
} from "@/lib/api";

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const VisualCanvas = dynamic(
  () => import("@/components/workspace/VisualCanvas").then((m) => m.VisualCanvas),
  { ssr: false },
);

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
  const [viva, setViva] = useState<{ id: string; prompt: string }[]>([]);
  const [vivaAnswers, setVivaAnswers] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

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

  const fallbackSeq = useMemo(() => {
    if (!problem) return undefined;
    // best-effort from examples text is hard; leave undefined until run focus fills
    return undefined;
  }, [problem]);

  async function onSee() {
    if (!problem) return;
    setBusy(true);
    setTestMsg(null);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "brute" });
      setRun(res);
      setEventIdx(0);
      setPlaying(true);
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
          setPredictMsg("All predictions passed. Move to Code & Trace.");
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

  async function onTrace() {
    if (!problem) return;
    setBusy(true);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "student", code });
      setRun(res);
      setEventIdx(0);
      setPlaying(true);
      if (res.ok) setStage((s) => Math.max(s, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trace failed");
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    if (!problem) return;
    setBusy(true);
    setTestMsg(null);
    try {
      const res = await runTests(problem.id, code);
      setStage(Math.max(stage, res.stage, 4));
      const passed = res.results.filter((r) => r.passed).length;
      setTestMsg(`${passed}/${res.results.length} checks passed.${res.passed_all ? "" : " Fix failures, then re-test."}`);
      if (res.passed_all) {
        setViva(res.viva);
        setVivaAnswers(res.viva.map(() => ""));
      }
      // also show last student run insights
      setRun((prev) => ({
        ...(prev || {
          ok: res.passed_all,
          result: null,
          error: null,
          events: [],
          stdout: "",
          duration_ms: 0,
          performance: [],
        }),
        ast_insights: res.ast_insights,
      }));
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  async function onViva() {
    if (!problem) return;
    setBusy(true);
    try {
      const res = await submitViva(problem.id, vivaAnswers);
      setTestMsg(res.passed ? "Mastered — viva accepted." : res.detail || "Viva incomplete");
      if (res.passed) setStage(4);
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : "Viva failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-[var(--muted)]">Loading workspace…</div>;
  if (error && !problem) return <div className="p-8 text-red-700">{error}</div>;
  if (!problem) return null;

  if (stage === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link href={`/topics/${problem.topic}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
          ← Back to topic
        </Link>
        <h1 className="display mt-4 text-3xl font-semibold">{problem.title}</h1>
        <p className="mt-3 text-[var(--muted)]">
          Finish the Stage 0 concept check for <strong>{problem.topic}</strong> before entering the practice loop.
        </p>
        <Link
          href={`/topics/${problem.topic}`}
          className="mt-6 inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white"
        >
          Go to concept lesson
        </Link>
      </div>
    );
  }

  const step = problem.predict_steps[predictIdx];

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/topics/${problem.topic}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
            ← {problem.topic}
          </Link>
          <h1 className="display mt-1 text-3xl font-semibold">{problem.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {problem.pattern} · {problem.difficulty}
            {problem.mastered ? " · mastered" : ""}
          </p>
        </div>
        <StageRail stage={stage} onSelect={setStage} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.05fr_1.2fr_0.9fr]">
        <section className="panel order-1 space-y-4 rounded-xl p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Problem</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{problem.statement}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Examples</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {problem.examples.map((ex, i) => (
                <li key={i} className="rounded-md bg-black/[0.03] px-3 py-2">
                  <div>
                    <span className="font-medium">In:</span> {ex.input}
                  </div>
                  <div>
                    <span className="font-medium">Out:</span> {ex.output}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {stage === 1 && (
            <div className="rounded-lg border border-[var(--line)] bg-[#f7faf8] p-3">
              <h3 className="font-semibold">Stage 1 — See the problem</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Run the slow approach and watch why it struggles before you code.
              </p>
              <Button className="mt-3" onClick={onSee} disabled={busy}>
                Run brute-force demo
              </Button>
            </div>
          )}

          {stage === 2 && step && (
            <div className="rounded-lg border border-[var(--line)] bg-[#f7faf8] p-3">
              <h3 className="font-semibold">Stage 2 — Predict</h3>
              <p className="mt-2 text-sm">{step.prompt}</p>
              <input
                value={predictAnswer}
                onChange={(e) => setPredictAnswer(e.target.value)}
                className="mt-3 h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                placeholder="Your prediction"
              />
              <div className="mt-3 flex items-center gap-3">
                <Button onClick={onPredict} disabled={busy}>
                  Check
                </Button>
                {predictMsg && <span className="text-sm text-[var(--muted)]">{predictMsg}</span>}
              </div>
            </div>
          )}

          {stage >= 4 && (
            <div className="rounded-lg border border-[var(--line)] bg-[#f7faf8] p-3">
              <h3 className="font-semibold">Stage 4 — Edge cases & viva</h3>
              <Button className="mt-3" onClick={onTest} disabled={busy}>
                Run generated tests
              </Button>
              {testMsg && <p className="mt-2 text-sm text-[var(--muted)]">{testMsg}</p>}
              {viva.length > 0 && (
                <div className="mt-4 space-y-3">
                  {viva.map((q, i) => (
                    <div key={q.id}>
                      <p className="text-sm font-medium">{q.prompt}</p>
                      <textarea
                        value={vivaAnswers[i] || ""}
                        onChange={(e) =>
                          setVivaAnswers((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                        }
                        className="mt-2 w-full rounded-md border border-[var(--line)] bg-white p-2 text-sm"
                        rows={3}
                      />
                    </div>
                  ))}
                  <Button onClick={onViva} disabled={busy}>
                    Submit viva
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="order-2 flex min-h-[420px] flex-col gap-3 sm:min-h-[520px] xl:order-2">
          <div className="panel flex flex-1 flex-col overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
              <h2 className="text-sm font-semibold">Editor</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onTrace} disabled={busy || stage < 2}>
                  Trace
                </Button>
                <Button size="sm" onClick={onTest} disabled={busy || stage < 3}>
                  Test
                </Button>
              </div>
            </div>
            <div className="min-h-[280px] flex-1">
              <Monaco
                height="100%"
                defaultLanguage="python"
                theme="vs"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "IBM Plex Mono, ui-monospace, monospace",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
          <div className="panel rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Visual canvas</h2>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <button className="underline" onClick={() => setPlaying((p) => !p)} disabled={!events.length}>
                  {playing ? "Pause" : "Play"}
                </button>
                <span>
                  {events.length ? `${eventIdx + 1}/${events.length}` : "no frames"}
                </span>
              </div>
            </div>
            <div className="h-[280px]">
              <VisualCanvas visual={problem.visual} event={currentEvent} fallbackSequence={fallbackSeq} />
            </div>
            {run && (
              <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                <div>
                  {run.ok ? `Result: ${JSON.stringify(run.result)}` : `Error: ${run.error}`} · {run.duration_ms} ms
                </div>
                {run.ast_insights?.[0] && <div>AST: {run.ast_insights[0]}</div>}
                {run.performance?.length > 0 && (
                  <div>
                    Perf:{" "}
                    {run.performance.map((p) => `n=${p.n}:${p.ms}ms`).join(" · ")}
                  </div>
                )}
                {currentEvent && (
                  <div className="truncate">
                    Line {currentEvent.line} · {JSON.stringify(currentEvent.focus)}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="order-3 min-h-[360px] lg:col-span-2 xl:col-span-1 xl:min-h-[520px]">
          <AgentPanel
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
                  }
                : null
            }
          />
        </section>
      </div>
      {error && problem && (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
