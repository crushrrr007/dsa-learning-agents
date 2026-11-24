"use client";

import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import type { TraceEvent } from "@/lib/api";

const GraphCanvas = dynamic(() => import("./VisualCanvas").then((module) => module.VisualCanvas), { ssr: false });
const pointerNames = ["left", "right", "mid", "read", "write", "insertPos", "insert_pos", "start", "end", "i", "j", "slow", "fast"];

export function traceValue(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "—";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function position(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return /^-?\d+$/.test(text) ? Number(text) : undefined;
}

function asSequence(value: unknown) {
  return Array.isArray(value) ? value : typeof value === "string" ? Array.from(value) : null;
}

function listValues(value: unknown) {
  if (!value || typeof value !== "object" || !("__list_nodes__" in value)) return null;
  const nodes = value.__list_nodes__;
  return Array.isArray(nodes) ? nodes.map((node) => node?.cycle ? "↻ cycle" : node?.val) : null;
}

export function TraceState({ visual, frame, previous, args }: {
  visual: string;
  frame: TraceEvent | null;
  previous: TraceEvent | null;
  args: unknown[];
}) {
  const focus = frame?.focus ?? {};
  const before = previous?.focus ?? {};
  const live = (visual === "dp" ? asSequence(focus.dp) : null)
    ?? (visual === "linkedlist" ? listValues(focus.list_head) : null)
    ?? asSequence(focus.sequence);
  const prior = (visual === "dp" ? asSequence(before.dp) : null)
    ?? (visual === "linkedlist" ? listValues(before.list_head) : null)
    ?? asSequence(before.sequence);
  const canShowInput = visual !== "dp" && visual !== "graph";
  const fallback = canShowInput ? asSequence(args[0]) : null;
  const matrix = Array.isArray(focus.grid) ? focus.grid
    : live?.length && live.every(Array.isArray) ? live
    : visual === "grid" && fallback?.every(Array.isArray) ? fallback : null;
  const sequence = live ?? fallback;
  const name = visual === "dp" && focus.dp ? "dp" : visual === "linkedlist" && focus.list_name ? focus.list_name : focus.sequence_name;
  const begin = position(focus.left) ?? position(focus.start);
  const end = position(focus.right) ?? position(focus.end);
  const auxiliary = focus.auxiliary && typeof focus.auxiliary === "object" ? Object.entries(focus.auxiliary).filter(([, values]) => Array.isArray(values)) : [];
  const previousAuxiliary = before.auxiliary && typeof before.auxiliary === "object" ? Object.fromEntries(Object.entries(before.auxiliary)) : {};

  if (visual === "tree" || visual === "graph") {
    const hasGraph = visual === "tree" ? Array.isArray(focus.tree) || Boolean(sequence?.length) : Boolean(focus.graph || focus.edges || typeof focus.n === "string" || typeof focus.n === "number");
    return hasGraph ? <div className="trace-graph"><GraphCanvas visual={visual} event={frame} fallbackSequence={fallback} /></div>
      : <p className="trace-empty">No {visual} structure on this frame. Step forward or inspect the variables.</p>;
  }
  if (matrix) {
    const rowPointer = position(focus.r) ?? position(focus.i);
    const columnPointer = position(focus.c) ?? position(focus.j);
    const visited = new Set((Array.isArray(focus.seen) ? focus.seen : []).flatMap((cell: unknown) => {
      if (Array.isArray(cell) && cell.length === 2) return [`${cell[0]},${cell[1]}`];
      const pair = typeof cell === "string" ? cell.match(/(-?\d+)\s*,\s*(-?\d+)/) : null;
      return pair ? [`${pair[1]},${pair[2]}`] : [];
    }));
    return <div className="trace-scroll"><table className="trace-matrix"><caption>{typeof focus.grid_name === "string" ? focus.grid_name : live ? "Table state" : "Input grid preview"}</caption><tbody>
      {matrix.slice(0, 30).map((row, r) => <tr key={r}>{(Array.isArray(row) ? row : [row]).slice(0, 30).map((value, c) => <td key={c} data-active={rowPointer === r && columnPointer === c} data-visited={visited.has(`${r},${c}`)} aria-label={`Row ${r}, column ${c}: ${traceValue(value)}${visited.has(`${r},${c}`) ? ", visited" : ""}`}>{traceValue(value)}</td>)}</tr>)}
    </tbody></table></div>;
  }
  if (!sequence) return <p className="trace-empty">No collection on this frame. The variable view still shows the recorded state.</p>;
  const label = live ? typeof name === "string" ? name : "Recorded collection" : "Input preview";
  const showBars = visual !== "linkedlist" && sequence.length > 0 && sequence.length <= 16 && sequence.every((value) => typeof value === "number" && Number.isFinite(value));
  const scale = showBars ? Math.max(1, ...sequence.map((value) => Math.abs(Number(value)))) : 1;
  return <div className="trace-structure">
    <div className="trace-state-label"><strong>{label}</strong><span>{sequence.length > 40 ? "First 40 values" : `${sequence.length} ${sequence.length === 1 ? "value" : "values"}`}</span></div>
    {sequence.length === 0 ? <p className="trace-empty">Empty collection</p> : <div className="trace-scroll" tabIndex={0} aria-label="Scrollable recorded values"><ol className="trace-cells" aria-label="Recorded values">
      {sequence.slice(0, 40).map((value, index) => {
        const pointers = live ? pointerNames.filter((key) => position(focus[key]) === index) : [];
        const changed = Boolean(previous && prior && (index >= prior.length || traceValue(prior[index]) !== traceValue(value)));
        const window = visual === "window" && live && begin !== undefined && end !== undefined && index >= begin && index <= end;
        return <li key={index} data-pointer={pointers.length > 0} data-changed={changed} data-window={Boolean(window)} data-linked={visual === "linkedlist"}>
          {showBars && <span className="trace-magnitude" aria-hidden="true"><span style={{ height: `${Math.max(4, 100 * Math.abs(Number(value)) / scale)}%` }} /></span>}
          <span className="trace-cell-pointer">{pointers.join(" · ")}</span><strong title={traceValue(value)}>{traceValue(value)}</strong><span className="trace-cell-index" aria-label={`Index ${index}`}>{index}</span>
          {visual === "linkedlist" && index < sequence.length - 1 && <ArrowRight size={15} className="trace-node-arrow" aria-hidden="true" />}
        </li>;
      })}
    </ol></div>}
    {auxiliary.map(([key, values]) => <div className="trace-aux" key={key}><strong>{key}</strong><div className="trace-scroll"><ol className="trace-aux-values" aria-label={`${key} values`}>
      {(values as unknown[]).slice(0, 40).map((value, index) => <li key={index} data-changed={Boolean(previous && traceValue(previousAuxiliary[key]?.[index]) !== traceValue(value))}>{traceValue(value)}</li>)}
      {values.length === 0 && <li>Empty</li>}
    </ol></div></div>)}
    {(live || showBars) && <p className="trace-key">{showBars && <span>Bar height shows magnitude</span>}{live && <><span>Named pointers mark positions</span><span>Outlined values changed</span></>}</p>}
  </div>;
}
