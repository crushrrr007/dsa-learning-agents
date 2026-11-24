"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Code2, Lock, MessagesSquare, Play, Send } from "lucide-react";
import { LearningChecklist } from "@/components/workspace/LearningChecklist";
import { TraceExplorer, type TraceOrigin } from "@/components/workspace/TraceExplorer";
import { WorkspaceConsole, type ConsoleTab } from "@/components/workspace/WorkspaceConsole";
import { Button } from "@/components/ui/button";
import { AgentDock } from "@/components/workspace/AgentDock";
import { WORKSPACE_AGENTS, agentForWorkspaceStage, type AgentId } from "@/lib/agents";
import {
  StageRail,
  WORKSPACE_STAGES,
  nextActionCopy,
  resolveActiveStage,
  type WorkspaceStageId,
} from "@/components/workspace/StageRail";
import {
  fetchProblem,
  fetchProblems,
  runCode,
  runTests,
  submitPredict,
  submitViva,
  type ProblemDetail,
  type RunResponse,
  type TraceEvent,
  type VivaQuestionResult,
  type WorkspaceTestCase,
} from "@/lib/api";

function syncEditorTrace(editor: Parameters<OnMount>[0] | null, decoration: ReturnType<Parameters<OnMount>[0]["createDecorationsCollection"]> | null, line: number | null) {
  if (!decoration) return;
  if (line === null) {
    decoration.clear();
    return;
  }
  decoration.set([{ range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 }, options: { isWholeLine: true, className: "workspace-executing-line", linesDecorationsClassName: "workspace-executing-gutter" } }]);
  editor?.revealLineInCenterIfOutsideViewport(line);
}

function EditorLoading() {
  return <p role="status" className="px-4 py-3 text-sm text-[var(--surface)]/70">Loading Python editor…</p>;
}

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: EditorLoading });

type LeftTab = "description" | "path" | "trace";

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (x === "hard") return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
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
  const pattern = problem.pattern_id || problem.pattern;
  const { data: relatedProblems } = useSWR(["related-problems", pattern], () => fetchProblems(undefined, pattern));
  const related = relatedProblems?.filter((item) => item.id !== problem.id).slice(0, 5) ?? [];
  const [mastered, setMastered] = useState(problem.mastered);
  const [stage, setStage] = useState(Math.max(1, problem.stage));
  const [code, setCode] = useState(problem.last_code || problem.starter_code);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [traceSpeed, setTraceSpeed] = useState(1);
  const [traceOrigin, setTraceOrigin] = useState<TraceOrigin>({ mode: "demo", args: problem.demo_args });
  const [coachPrompt, setCoachPrompt] = useState<{ text: string; agent: AgentId } | null>(null);
  const [predictIdx, setPredictIdx] = useState(problem.next_predict_index);
  const [predictAnswer, setPredictAnswer] = useState("");
  const [predictMsg, setPredictMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<WorkspaceTestCase[]>([]);
  const [studentRun, setStudentRun] = useState<{ response: RunResponse; code: string } | null>(null);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const [editorAction, setEditorAction] = useState<"run" | "submit" | null>(null);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("output");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"problem" | "editor">(problem.stage === 3 ? "editor" : "problem");
  const [plainEditor, setPlainEditor] = useState(false);
  const [savedCode, setSavedCode] = useState(problem.last_code || problem.starter_code);
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
  const traceDecoration = useRef<ReturnType<Parameters<OnMount>[0]["createDecorationsCollection"]> | null>(null);
  const plainEditorRef = useRef<HTMLTextAreaElement>(null);
  const coachPanelRef = useRef<HTMLElement>(null);
  const coachTriggerRef = useRef<HTMLButtonElement>(null);

  const events: TraceEvent[] = run?.events || [];
  const currentEvent = events[eventIdx] || null;
  const traceLine = leftTab === "trace" && traceOrigin.mode === "student" && traceOrigin.code === code && currentEvent && currentEvent.line > 0 ? currentEvent.line : null;

  useEffect(() => {
    if (!plainEditor) syncEditorTrace(editorRef.current, traceDecoration.current, traceLine);
  }, [plainEditor, traceLine]);

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
    }, 700 / traceSpeed);
    return () => clearInterval(t);
  }, [playing, events.length, traceSpeed]);

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

  function onSee() {
    return traceDemo();
  }

  async function traceDemo(args?: unknown[]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPlaying(false);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "brute", args });
      if (!res.ok) {
        setError(args ? `Custom input failed: ${res.error?.trim().split("\n").at(-1) ?? "Check the argument values."}` : "The demo couldn’t run. Try again before moving to Predict.");
        return;
      }
      setRun(res);
      setCoachPrompt(null);
      setEventIdx(0);
      setTraceOrigin({ mode: "demo", args: args ?? problem.demo_args, custom: Boolean(args) });
      setPlaying(!args && res.events.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setStage(res.stage);
      setSelectedStage(null);
      setLeftTab("trace");
      setMobilePane("problem");
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
          setMobilePane("editor");
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

  async function onRun(args?: unknown[]) {
    if (busy || stage < 3 || !code.trim()) return;
    setBusy(true);
    setEditorAction("run");
    setError(null);
    setStudentRun(null);
    setRunNotice("Running Python…");
    setConsoleTab("output");
    setConsoleOpen(true);
    try {
      const res = await runCode({ problem_id: problem.id, mode: "student", code, args });
      setTestResults([]);
      setTestMsg(null);
      setSavedCode(code);
      setStudentRun({ response: res, code });
      setRun(res);
      setCoachPrompt(null);
      setEventIdx(0);
      setPlaying(false);
      setTraceOrigin({ mode: "student", code, args: args ?? problem.demo_args, custom: Boolean(args) });
      if (args) {
        setLeftTab("trace");
        setMobilePane("problem");
        setError(res.ok ? null : `Custom input failed: ${res.error?.trim().split("\n").at(-1) ?? "Check the argument values."}`);
      }
      setStage(res.stage);
      if (res.stage < 4) clearViva();
      else if (!mastered && !viva.length) {
        setViva((problem.viva ?? []).map(({ question }, index) => ({ id: `q${index}`, prompt: question })));
      }
      setRunNotice(res.ok ? "Run completed." : `Runtime error: ${res.error?.trim().split("\n").at(-1) || "The run did not complete."}`);
      if (!res.ok) {
        setCoachPrompt({ text: "My last run failed. What should I inspect first?", agent: "code_mentor" });
        setAgentsOpen(true);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Run failed. Try again.";
      setRunNotice(message);
      if (args || leftTab === "trace") setError(message);
    } finally {
      setEditorAction(null);
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (busy || stage < 3 || !code.trim()) return;
    setBusy(true);
    setEditorAction("submit");
    setError(null);
    setConsoleTab("tests");
    setConsoleOpen(true);
    setTestResults([]);
    setTestMsg("Checking your submission…");
    try {
      const res = await runTests(problem.id, code);
      setStage(res.stage);
      setSavedCode(code);
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
      } else if (!res.passed_all) {
        setCoachPrompt({ text: "I did not pass every case. Use the available evidence to suggest one debugging step without giving me the solution.", agent: "code_mentor" });
        setAgentsOpen(true);
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
      setEditorAction(null);
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
    const coding = id === "code" || id === "test";
    setSelectedStage(id);
    setLeftTab(coding ? "description" : "path");
    setMobilePane(coding ? "editor" : "problem");
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
      requestAnimationFrame(() => {
        if (plainEditor) plainEditorRef.current?.focus();
        else editorRef.current?.focus();
      });
    }
  }

  function toggleCoaches(trigger?: HTMLButtonElement) {
    if (agentsOpen) {
      setAgentsOpen(false);
      requestAnimationFrame(() => (trigger ?? coachTriggerRef.current)?.focus());
    } else {
      coachTriggerRef.current = trigger ?? null;
      setAgentsOpen(true);
      requestAnimationFrame(() => coachPanelRef.current?.focus());
    }
  }

  function openCoach(text: string, agent: AgentId) {
    setPlaying(false);
    setCoachPrompt({ text, agent });
    setAgentsOpen(true);
    requestAnimationFrame(() => coachPanelRef.current?.focus());
  }

  const locked = stage < 3;
  const step = problem.predict_steps[Math.min(predictIdx, problem.predict_steps.length - 1)];
  const stageMeta = WORKSPACE_STAGES.find((s) => s.id === resolved);
  const coach = WORKSPACE_AGENTS.find((agent) => agent.id === agentForWorkspaceStage(resolved)) ?? WORKSPACE_AGENTS[0];

  const failedExample = testResults.find((test) => test.visible && !test.passed);
  const lastRun = run
    ? {
        error: testResults.length ? failedExample?.error : run.error,
        result: testResults.length ? undefined : run.result,
        ast_insights: run.ast_insights,
        active_frame: currentEvent,
        event_count: run.events.length,
        ok: testResults.length ? testResults.every((test) => test.passed) : run.ok,
        failed_case: failedExample ? { expected: failedExample.expected, got: failedExample.got } : undefined,
      }
    : null;

  return (
    <div className="flex flex-col bg-[var(--bg)] lg:h-[calc(100dvh-var(--topbar-height))] lg:min-h-[620px]">
      <header className="workspace-merged-heading border-b border-[var(--ws-line)] bg-[var(--ws-panel)] px-4 py-3 text-[var(--ws-text)] sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/topics/${problem.topic}`} className="w-fit text-sm font-semibold capitalize text-[var(--ws-muted)] hover:underline">
              ← {problem.topic.replace(/-/g, " ")}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance font-serif text-xl font-semibold sm:text-2xl">{problem.title}</h1>
              <span className={`rounded border px-2 py-0.5 text-xs font-semibold capitalize ${diffClass(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
              {mastered && <span className="workspace-heading-chip">Mastered</span>}
              <span className="workspace-heading-chip">Python lab</span>
              <Link href={`/problems?pattern=${encodeURIComponent(pattern)}`} className="workspace-heading-chip hover:underline">{problem.pattern}</Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="workspace-heading-chip" title={coach.job} aria-expanded={agentsOpen} aria-controls="workspace-coaches" onClick={(event) => toggleCoaches(event.currentTarget)}>On deck: {coach.title}</button>
            <StageRail stage={stage} active={uiStage} vivaReady={vivaReady} mastered={mastered} onSelect={onSelectStage} />
          </div>
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

      <div className="workspace-mobile-nav" role="group" aria-label="Workspace panels">
        <button type="button" aria-pressed={mobilePane === "problem"} onClick={() => setMobilePane("problem")}>Problem</button>
        <button type="button" aria-pressed={mobilePane === "editor"} onClick={() => setMobilePane("editor")}><Code2 size={16} aria-hidden="true" />Editor</button>
        <button type="button" className="workspace-coach-trigger" aria-expanded={agentsOpen} aria-controls="workspace-coaches" onClick={(event) => toggleCoaches(event.currentTarget)}><MessagesSquare size={16} aria-hidden="true" />Coaches</button>
      </div>
      <div className="workspace-grid" data-mobile-pane={mobilePane} data-coaches={agentsOpen ? "open" : "closed"}>
        <section className="workspace-problem flex min-h-0 min-w-0 flex-col border border-[var(--line)] bg-[var(--surface)]" aria-label="Problem and trace">
          <div className="border-b border-[var(--line)] px-3 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Problem</p>
          </div>
          <div className="flex gap-1 border-b border-[var(--line)] px-2 pt-1">
            {(
              [
                ["path", "Learn path"],
                ["trace", "Visual"],
                ["description", "Problem"],
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
                {related.length > 0 && <section aria-label="Related problems"><h3 className="text-sm font-bold">Related problems</h3><ul className="mt-2 flex flex-col gap-2">{related.map((item) => <li key={item.id}><Link href={`/problems/${item.id}`} className="learn-text-link">{item.title}</Link></li>)}</ul></section>}
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
                        <div className="flex flex-wrap items-center gap-3">
                          <button type="button" className="learn-text-link" onClick={() => setLeftTab("trace")}>Review the trace</button>
                          <button type="button" className="learn-text-link" onClick={() => openCoach(`Help me reason through this prediction without answering it: ${step.prompt}`, "predict_coach")}>Ask Predict Coach</button>
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
                      <div className="mt-2 flex flex-col gap-2"><p className="text-sm text-[var(--muted)]">Mastery is saved for this guest session.</p><Link className="learn-text-link" href={`/practice?pattern=${encodeURIComponent(problem.pattern_id ?? problem.pattern)}`}>Try another problem in this pattern</Link></div>
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

            {leftTab === "path" && <LearningChecklist stage={stage} active={resolved} ranCode={Boolean(studentRun)} mastered={mastered} />}

            {leftTab === "trace" && <TraceExplorer
              visual={problem.visual} events={events} index={eventIdx} playing={playing} speed={traceSpeed} busy={busy}
              origin={traceOrigin} demoArgs={problem.demo_args} demoPreview={problem.demo_preview}
              onSeek={(index) => { setPlaying(false); setCoachPrompt(null); setEventIdx(index); }}
              onPlay={() => { setCoachPrompt(null); if (!playing && eventIdx === events.length - 1) setEventIdx(0); setPlaying(!playing); }}
              onSpeed={setTraceSpeed} onDemo={() => void onSee()}
              onTraceCode={!locked ? () => void onRun() : undefined}
              onCustom={(args) => { if (locked) void traceDemo(args); else void onRun(args); }}
              onCoach={() => openCoach(`What should I watch in frame ${eventIdx + 1} at line ${currentEvent?.line}, without giving away the solution?`, "demo_coach")}
            />}
          </div>
        </section>

        <section className="workspace-editor" aria-label="Python editor and results">
          <header className="workspace-editor-toolbar">
            <div className="workspace-editor-title"><Code2 size={18} aria-hidden="true" /><div><strong>Python 3</strong><p>{locked ? "Locked until Predict" : code !== savedCode ? "Unsaved edits" : "Saves on Run or Submit"}</p></div></div>
            <div className="workspace-editor-actions">
              {!locked && <button type="button" aria-pressed={plainEditor} disabled={busy} onClick={() => setPlainEditor(!plainEditor)} className="workspace-editor-mode">Plain text</button>}
              <button type="button" aria-expanded={agentsOpen} aria-controls="workspace-coaches" className="workspace-editor-mode workspace-coach-trigger workspace-desktop-trigger" onClick={(event) => toggleCoaches(event.currentTarget)}><MessagesSquare size={16} aria-hidden="true" />Coaches</button>
              <Button size="sm" variant="secondary" type="button" onClick={() => void onRun()} disabled={busy || locked || !code.trim()} aria-keyshortcuts="Control+Enter Meta+Enter" title="Run · Ctrl/⌘ + Enter"><Play size={15} aria-hidden="true" />{editorAction === "run" ? "Running…" : "Run"}</Button>
              <Button size="sm" type="button" onClick={onSubmit} disabled={busy || locked || !code.trim()} aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter" title="Submit · Ctrl/⌘ + Shift + Enter"><Send size={15} aria-hidden="true" />{editorAction === "submit" ? "Checking…" : "Submit"}</Button>
            </div>
          </header>

          <div className="workspace-editor-body" onKeyDownCapture={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              event.stopPropagation();
              if (event.shiftKey) void onSubmit();
              else void onRun();
            }
          }}>
            {locked ? (
              <div className="workspace-editor-lock">
                <Lock size={23} aria-hidden="true" />
                <div><p className="font-semibold">Editor unlocks after Predict</p><p>Watch the demo and finish the predictions before writing code.</p></div>
                <Button size="sm" variant="secondary" type="button" onClick={() => { setLeftTab("path"); setMobilePane("problem"); }}>Open learn path</Button>
              </div>
            ) : plainEditor ? (
              <textarea ref={plainEditorRef} className="workspace-plain-code font-mono" aria-label="Python code editor" value={code} readOnly={busy} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => onCodeChange(event.target.value)} />
            ) : (
              <Monaco
                height="100%"
                defaultLanguage="python"
                loading={<EditorLoading />}
                theme="vs-dark"
                value={code}
                onChange={onCodeChange}
                onMount={(editor) => {
                  editorRef.current = editor;
                  traceDecoration.current = editor.createDecorationsCollection();
                  syncEditorTrace(editor, traceDecoration.current, traceLine);
                }}
                options={{
                  ariaLabel: "Python code editor",
                  readOnly: busy,
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 14 },
                  tabSize: 4,
                  fontFamily: "ui-monospace, monospace",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            )}
          </div>

          {!locked && <WorkspaceConsole
            tab={consoleTab}
            open={consoleOpen}
            note={consoleTab === "output" ? runNotice : testMsg}
            run={studentRun?.response ?? null}
            tests={testResults}
            stale={consoleTab === "output" ? Boolean(studentRun && studentRun.code !== code) : code !== savedCode}
            onTab={(tab) => { setConsoleTab(tab); setConsoleOpen(true); }}
            onToggle={() => setConsoleOpen(!consoleOpen)}
            onTrace={traceOrigin.mode === "student" && events.length ? () => { setLeftTab("trace"); setMobilePane("problem"); } : undefined}
            onCoach={failedExample && code === savedCode ? () => openCoach("Compare my result with the visible test that failed. Give me one next debugging step, not a solution.", "code_mentor") : undefined}
          />}
        </section>

        <aside id="workspace-coaches" ref={coachPanelRef} tabIndex={-1} aria-labelledby="workspace-coaches-title" hidden={!agentsOpen} className="workspace-coach-panel">
          <div className="workspace-coach-heading"><h2 id="workspace-coaches-title">Practice coaches</h2><button type="button" className="workspace-editor-mode" onClick={() => toggleCoaches()}>Hide coaches</button></div>
          <div className="min-h-0 flex-1">
            <AgentDock topic={problem.topic} problemId={problem.id} stage={stage} code={code} lastRun={lastRun} suggestedAgent={coach.id} contextualPrompt={coachPrompt} />
          </div>
        </aside>
      </div>
    </div>
  );
}
