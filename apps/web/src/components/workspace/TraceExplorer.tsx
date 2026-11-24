"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Film, MessagesSquare, Pause, Play, RotateCcw } from "lucide-react";
import type { TraceEvent } from "@/lib/api";
import { TraceState, traceValue } from "./TraceState";

export type TraceOrigin = { mode: "demo" | "student"; code?: string; args: unknown[]; custom?: boolean };
const eventLabels: Record<string, string> = { call: "Enter a function", line: "About to execute", return: "Return from a function", exception: "Python raised an exception" };

function CodeFrame({ code, activeLine }: { code?: string; activeLine?: number }) {
  if (!code) return <p className="trace-empty">The lesson trace shows recorded state without revealing solution code. Run your own Python to see the executing source line highlighted here.</p>;
  const lines = code.split(/\r?\n/);
  const at = Math.min(lines.length - 1, Math.max(0, (activeLine ?? 1) - 1));
  const start = Math.max(0, at - 3);
  return <ol className="trace-source" start={start + 1} aria-label="Python source of the recorded run">
    {lines.slice(start, at + 5).map((text, offset) => {
      const line = start + offset + 1;
      return <li key={line} aria-current={line === activeLine ? "step" : undefined} data-trace-line={line}><span>{line}</span><code>{text || " "}</code></li>;
    })}
  </ol>;
}

function TraceInputs({ args, busy, student, onRun }: { args: unknown[]; busy: boolean; student: boolean; onRun: (args: unknown[]) => void }) {
  const initial = JSON.stringify(args);
  const [input, setInput] = useState(initial);
  const [error, setError] = useState("");
  return <details className="trace-inputs">
    <summary>Try a custom input</summary>
    <form onSubmit={(event) => {
      event.preventDefault();
      try {
        const parsed: unknown = JSON.parse(input);
        if (!Array.isArray(parsed) || parsed.length !== args.length) {
          setError(`Use a JSON array containing ${args.length} positional ${args.length === 1 ? "argument" : "arguments"}.`);
          return;
        }
        setError("");
        onRun(parsed);
      } catch {
        setError("Enter valid JSON. Use double quotes around strings.");
      }
    }}>
      <label htmlFor="trace-custom-input">Python arguments as JSON</label>
      <p>Put all arguments in one array. A single list argument needs an extra pair of brackets.</p>
      <textarea id="trace-custom-input" className="font-mono" maxLength={4000} rows={2} value={input} onChange={(event) => { setInput(event.target.value); setError(""); }} spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? "trace-input-error" : undefined} />
      {error && <p id="trace-input-error" role="alert" className="text-[var(--bad)]">{error}</p>}
      <div className="flex flex-wrap items-center gap-2"><button className="learn-button" type="submit" disabled={busy}>Trace custom input</button><button type="button" className="learn-text-link" onClick={() => { setInput(initial); setError(""); }}>Restore example</button></div>
      <p>{student ? "Runs your current editor code. It does not count as a submission." : "Runs the lesson code without unlocking predictions. Run the default lesson demo to continue."}</p>
    </form>
  </details>;
}

export function TraceExplorer({ visual, events, index, playing, speed, busy, origin, demoArgs, demoPreview, onSeek, onPlay, onSpeed, onDemo, onTraceCode, onCustom, onCoach }: {
  visual: string; events: TraceEvent[]; index: number; playing: boolean; speed: number; busy: boolean; origin: TraceOrigin; demoArgs: unknown[]; demoPreview?: unknown[] | null;
  onSeek: (index: number) => void; onPlay: () => void; onSpeed: (speed: number) => void; onDemo: () => void; onTraceCode?: () => void; onCustom: (args: unknown[]) => void; onCoach: () => void;
}) {
  const frame = events[index] ?? null;
  const previous = events[index - 1] ?? null;
  const variables = Object.entries(frame?.locals ?? {}).slice(0, 12);
  const changed = variables.filter(([key, value]) => previous && traceValue(previous.locals[key]) !== traceValue(value));
  return <section className="trace-lab" aria-labelledby="trace-lab-heading">
    <div className="trace-lab-title"><div><p className="learn-kicker"><Film size={16} aria-hidden="true" /> Python trace</p><h2 id="trace-lab-heading" className="font-serif">Execution visualizer</h2></div><span className="learn-pill">{origin.mode === "student" ? "Your code" : "Lesson demo"}{origin.custom ? " · Custom input" : ""}</span></div>
    <div className="trace-playback" role="group" aria-label="Trace playback">
      <div className="trace-controls">
        <button type="button" aria-label="First frame" title="First frame" disabled={index === 0} onClick={() => onSeek(0)}><RotateCcw size={17} aria-hidden="true" /></button>
        <button type="button" aria-label="Previous frame" disabled={index === 0} onClick={() => onSeek(index - 1)}><ChevronLeft size={19} aria-hidden="true" /></button>
        <button type="button" className="trace-play" disabled={events.length < 2} onClick={onPlay}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? "Pause" : "Play"}</button>
        <button type="button" aria-label="Next frame" disabled={index >= events.length - 1} onClick={() => onSeek(index + 1)}><ChevronRight size={19} aria-hidden="true" /></button>
      </div>
      <label className="trace-speed">Speed <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
      <div className="trace-scrubber"><span>{events.length ? `Frame ${index + 1} of ${events.length}` : "Not started"}</span><input type="range" aria-label="Trace frame" min={0} max={Math.max(0, events.length - 1)} value={index} disabled={events.length < 2} onChange={(event) => onSeek(Number(event.target.value))} /></div>
    </div>
    <div className="trace-stage" aria-label="Data structure state">
      <TraceState visual={visual} frame={frame} previous={previous} args={!frame && origin.mode === "demo" && !origin.custom && demoPreview ? [demoPreview] : origin.args} />
      <div className="flex flex-wrap items-center gap-2"><button type="button" className={frame ? "learn-text-link" : "learn-button"} disabled={busy} onClick={onDemo}>{frame ? "Re-run lesson demo" : "Run lesson demo"}</button>{!frame && onTraceCode && <button type="button" className="learn-text-link" disabled={busy} onClick={onTraceCode}>Trace my code</button>}</div>
    </div>
    {frame && <div className="trace-frame-bar"><div><strong>{eventLabels[frame.event] ?? frame.event}</strong><span> · Line {frame.line}</span>{changed.length > 0 && <p>Changed since last frame: {changed.map(([name]) => name).join(", ")}</p>}</div><button type="button" className="learn-text-link" onClick={onCoach}><MessagesSquare size={17} aria-hidden="true" />Ask about this frame</button></div>}
    <div className="trace-inspector">
      <section aria-label="Source inspection"><h3>Source</h3><CodeFrame code={origin.code} activeLine={frame?.line} /></section>
      <section aria-label="Variable inspection"><h3>Variables</h3>{variables.length ? <dl className="trace-variables">{variables.map(([name, value]) => <div key={name} data-changed={changed.some(([key]) => key === name)}><dt title={name}>{name}</dt><dd title={traceValue(value)}>{traceValue(value)}</dd></div>)}</dl> : <p className="trace-empty">No local variables on this frame.</p>}</section>
    </div>
    {frame && <details className="trace-inputs"><summary>Raw frame details</summary><pre className="mt-2 max-h-56 overflow-auto font-mono text-xs">{JSON.stringify(frame, null, 2)}</pre></details>}
    <TraceInputs key={JSON.stringify(demoArgs)} args={demoArgs} busy={busy} student={Boolean(onTraceCode)} onRun={onCustom} />
  </section>;
}
