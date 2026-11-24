"use client";

import { useMemo, useRef, type ReactNode } from "react";
import type { TraceEvent } from "@/lib/api";

type Props = {
  visual: string;
  event: TraceEvent | null;
  fallbackSequence?: unknown;
  caption?: string | null;
  frameLabel?: string | null;
};

function parseSequence(focus: Record<string, unknown>, fallback?: unknown): unknown[] {
  if (Array.isArray(focus.sequence)) return focus.sequence as unknown[];
  if (Array.isArray(focus.dp)) return focus.dp as unknown[];
  if (Array.isArray(focus.tree)) return focus.tree as unknown[];
  if (typeof focus.sequence === "string") {
    try {
      const v = JSON.parse(focus.sequence.replace(/'/g, '"'));
      if (Array.isArray(v)) return v;
    } catch {
      return String(focus.sequence).split("");
    }
  }
  if (Array.isArray(fallback)) return fallback;
  if (typeof fallback === "string") return fallback.split("");
  return [];
}

function pointerIndex(focus: Record<string, unknown>, key: string): number | null {
  const raw = focus[key];
  if (raw == null) return null;
  const n = Number(String(raw).replace(/['"]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function parseSeenCells(seen: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(seen)) return out;
  for (const item of seen) {
    if (Array.isArray(item) && item.length >= 2) {
      out.add(cellKey(Number(item[0]), Number(item[1])));
    } else if (typeof item === "string") {
      const m = item.match(/(-?\d+)\s*,\s*(-?\d+)/);
      if (m) out.add(cellKey(Number(m[1]), Number(m[2])));
    }
  }
  return out;
}

type Ptr = { key: string; index: number; label: string; color: string };

const PTR_COLORS = ["#0d9488", "#2563eb", "#c2410c", "#7c3aed", "#b45309"];

function collectPointers(focus: Record<string, unknown>, len: number): Ptr[] {
  const keys: { key: string; label: string }[] = [
    { key: "left", label: "L" },
    { key: "right", label: "R" },
    { key: "slow", label: "slow" },
    { key: "fast", label: "fast" },
    { key: "write", label: "write" },
    { key: "mid", label: "mid" },
    { key: "i", label: "i" },
    { key: "j", label: "j" },
    { key: "k", label: "k" },
    { key: "curr", label: "curr" },
    { key: "prev", label: "prev" },
  ];
  const out: Ptr[] = [];
  const used = new Set<number>();
  for (const { key, label } of keys) {
    const idx = pointerIndex(focus, key);
    if (idx == null || idx < 0 || (len > 0 && idx >= len)) continue;
    // Prefer named pointers over generic i/j when both present at same index
    if (used.has(idx) && (key === "i" || key === "j")) continue;
    used.add(idx);
    out.push({
      key,
      index: idx,
      label,
      color: PTR_COLORS[out.length % PTR_COLORS.length],
    });
  }
  return out;
}

function focusCaption(focus: Record<string, unknown>, visual: string): string {
  const bits: string[] = [];
  for (const k of ["left", "right", "i", "j", "slow", "fast", "mid", "write", "target", "u", "v"]) {
    if (focus[k] != null) bits.push(`${k}=${String(focus[k]).replace(/'/g, "")}`);
  }
  if (bits.length) return bits.join(" · ");
  if (visual === "tree") return "Tree snapshot from the current frame";
  if (visual === "graph") return "Graph snapshot from the current frame";
  if (visual === "grid") return "Grid snapshot from the current frame";
  return "Run the demo to animate pointers step by step";
}

function ArrayViz({
  sequence,
  pointers,
  windowMode,
}: {
  sequence: unknown[];
  pointers: Ptr[];
  windowMode: boolean;
}) {
  const left = pointers.find((p) => p.key === "left" || p.key === "i" || p.key === "slow")?.index;
  const right = pointers.find((p) => p.key === "right" || p.key === "j" || p.key === "fast")?.index;
  const ptrByIndex = new Map<number, Ptr[]>();
  for (const p of pointers) {
    const list = ptrByIndex.get(p.index) || [];
    list.push(p);
    ptrByIndex.set(p.index, list);
  }

  if (!sequence.length) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">
        Run a demo to stream array frames — AlgoMaster-style pointer animation.
      </div>
    );
  }

  const numeric = sequence.every((v) => typeof v === "number" || (typeof v === "string" && /^-?\d+$/.test(v)));
  const nums = numeric ? sequence.map((v) => Number(v)) : [];
  const maxAbs = nums.length ? Math.max(1, ...nums.map((n) => Math.abs(n))) : 1;

  return (
    <div className="flex h-full min-h-[220px] flex-col justify-center gap-4 px-3 py-4">
      {numeric && sequence.length <= 16 && (
        <div className="flex items-end justify-center gap-1.5 px-2" style={{ height: 88 }}>
          {nums.map((n, idx) => {
            const h = Math.max(8, Math.round((Math.abs(n) / maxAbs) * 72));
            const inWin =
              windowMode && left != null && right != null
                ? idx >= Math.min(left, right) && idx <= Math.max(left, right)
                : false;
            const isPtr = ptrByIndex.has(idx);
            return (
              <div key={idx} className="flex w-10 flex-col items-center justify-end" style={{ height: 88 }}>
                <div
                  className="w-full rounded-t-md transition-all duration-300"
                  style={{
                    height: h,
                    background: isPtr ? "#0d9488" : inWin ? "#99f6e4" : "#cbd5e1",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="mx-auto flex w-max flex-col items-center gap-2">
          {/* Index row */}
          <div className="flex gap-1.5">
            {sequence.map((_, idx) => (
              <div key={idx} className="w-14 text-center text-[10px] font-bold tabular-nums text-slate-400">
                {idx}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="relative flex gap-1.5">
            {windowMode && left != null && right != null && left !== right && (
              <div
                className="pointer-events-none absolute top-0 h-14 rounded-xl bg-sky-400/15 transition-all duration-300"
                style={{
                  left: Math.min(left, right) * (56 + 6),
                  width: (Math.abs(right - left) + 1) * 56 + Math.abs(right - left) * 6,
                }}
              />
            )}
            {sequence.map((v, idx) => {
              const ptrs = ptrByIndex.get(idx) || [];
              const isPtr = ptrs.length > 0;
              const inWin =
                windowMode && left != null && right != null
                  ? idx >= Math.min(left, right) && idx <= Math.max(left, right)
                  : false;
              const border = isPtr ? ptrs[0].color : inWin ? "#38bdf8" : "#e2e8f0";
              return (
                <div
                  key={idx}
                  className="relative z-[1] flex h-14 w-14 items-center justify-center rounded-xl border-2 bg-white text-base font-bold text-slate-800 shadow-sm transition-all duration-300"
                  style={{
                    borderColor: border,
                    background: isPtr ? `${ptrs[0].color}14` : inWin ? "#f0f9ff" : "#fff",
                    transform: isPtr ? "translateY(-2px) scale(1.04)" : undefined,
                    boxShadow: isPtr ? `0 8px 20px ${ptrs[0].color}33` : undefined,
                  }}
                >
                  {String(v)}
                </div>
              );
            })}
          </div>

          {/* Pointer badges */}
          <div className="relative flex gap-1.5" style={{ minHeight: 56 }}>
            {sequence.map((_, idx) => {
              const ptrs = ptrByIndex.get(idx) || [];
              return (
                <div key={idx} className="flex w-14 flex-col items-center gap-1">
                  {ptrs.map((p) => (
                    <div key={p.key} className="flex flex-col items-center">
                      <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden>
                        <path d="M6 0 L12 10 L0 10 Z" fill={p.color} />
                      </svg>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
                        style={{ background: p.color }}
                      >
                        {p.label}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedListViz({ sequence, pointers }: { sequence: unknown[]; pointers: Ptr[] }) {
  const active = new Set(pointers.map((p) => p.index));
  if (!sequence.length) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">
        Run the demo to animate the linked list.
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[220px] items-center overflow-x-auto px-4 py-6">
      <div className="mx-auto flex items-center gap-0">
        {sequence.map((v, idx) => (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-base font-bold transition-all duration-300"
                style={{
                  borderColor: active.has(idx) ? "#0d9488" : "#cbd5e1",
                  background: active.has(idx) ? "#ccfbf1" : "#fff",
                  boxShadow: active.has(idx) ? "0 8px 20px rgba(13,148,136,0.25)" : undefined,
                }}
              >
                {String(v)}
              </div>
              {pointers
                .filter((p) => p.index === idx)
                .map((p) => (
                  <span
                    key={p.key}
                    className="rounded px-1.5 py-0.5 text-[10px] font-black text-white"
                    style={{ background: p.color }}
                  >
                    {p.label}
                  </span>
                ))}
            </div>
            {idx < sequence.length - 1 && (
              <svg width="36" height="16" viewBox="0 0 36 16" className="mx-0.5 shrink-0 text-slate-400">
                <path d="M0 8 H28" stroke="currentColor" strokeWidth="2" />
                <path d="M24 3 L34 8 L24 13 Z" fill="currentColor" />
              </svg>
            )}
          </div>
        ))}
        <span className="ml-2 font-mono text-xs text-slate-400">null</span>
      </div>
    </div>
  );
}

function TreeViz({ values }: { values: unknown[] }) {
  if (!values.length) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">
        Run the demo to animate the tree.
      </div>
    );
  }
  const depth = Math.floor(Math.log2(values.length)) + 1;
  const width = Math.max(320, Math.min(640, 48 * 2 ** Math.min(depth, 4)));
  const height = 40 + depth * 72;
  const nodes: { i: number; x: number; y: number; v: unknown }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null || values[i] === undefined) continue;
    const d = Math.floor(Math.log2(i + 1));
    const indexInLevel = i - (2 ** d - 1);
    const levelCount = 2 ** d;
    const x = ((indexInLevel + 0.5) / levelCount) * width;
    const y = 28 + d * 72;
    nodes.push({ i, x, y, v: values[i] });
  }
  const byIndex = new Map(nodes.map((n) => [n.i, n]));

  return (
    <div className="flex h-full min-h-[220px] items-center justify-center overflow-auto p-2">
      <svg width={width} height={height} className="max-w-full">
        {nodes.map((n) => {
          if (n.i === 0) return null;
          const parent = byIndex.get(Math.floor((n.i - 1) / 2));
          if (!parent) return null;
          return (
            <line
              key={`e${n.i}`}
              x1={parent.x}
              y1={parent.y}
              x2={n.x}
              y2={n.y}
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.i}>
            <circle cx={n.x} cy={n.y} r={20} fill="#ecfdf5" stroke="#0d9488" strokeWidth={2.5} />
            <text
              x={n.x}
              y={n.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-800 text-[13px] font-bold"
            >
              {String(n.v)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function GridViz({ focus }: { focus: Record<string, unknown> }) {
  const grid = Array.isArray(focus.grid) ? (focus.grid as unknown[][]) : [];
  const rowPtr = pointerIndex(focus, "r") ?? pointerIndex(focus, "i");
  const colPtr = pointerIndex(focus, "c") ?? pointerIndex(focus, "j");
  const visited = parseSeenCells(focus.seen);
  if (!grid.length) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">
        Run the demo to animate the grid.
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center overflow-auto p-4">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${grid[0]?.length || 1}, 2.75rem)` }}>
        {grid.map((row, r) =>
          (Array.isArray(row) ? row : [row]).map((cell, c) => {
            const cur = rowPtr === r && colPtr === c;
            const seen = visited.has(cellKey(r, c));
            return (
              <div
                key={`${r}-${c}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all duration-300"
                style={{
                  borderColor: cur ? "#c2410c" : seen ? "#0d9488" : "#e2e8f0",
                  background: cur ? "#fff7ed" : seen ? "#ccfbf1" : "#fff",
                }}
              >
                {String(cell)}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function GraphViz({ focus }: { focus: Record<string, unknown> }) {
  const graph = (focus.graph || {}) as Record<string, unknown[]>;
  const edgesRaw = (focus.edges || []) as unknown[];
  const ids = new Set<string>();
  Object.keys(graph).forEach((k) => {
    ids.add(k);
    for (const v of graph[k] || []) ids.add(String(v));
  });
  for (const e of edgesRaw) {
    if (Array.isArray(e) && e.length >= 2) {
      ids.add(String(e[0]));
      ids.add(String(e[1]));
    }
  }
  const nodeIds = Array.from(ids);
  const active = new Set(
    [focus.u, focus.v, focus.src, focus.dst]
      .filter((x) => x != null)
      .map((x) => String(x).replace(/['"]/g, "")),
  );
  const visited = new Set((Array.isArray(focus.seen) ? focus.seen : []).map((x) => String(x)));
  if (!nodeIds.length) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-slate-500">
        Run the demo to animate the graph.
      </div>
    );
  }
  const R = 110;
  const cx = 160;
  const cy = 130;
  const pos = nodeIds.map((id, i) => {
    const a = (i / nodeIds.length) * Math.PI * 2 - Math.PI / 2;
    return { id, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  const byId = new Map(pos.map((p) => [p.id, p]));
  const edges: [string, string][] = [];
  if (Object.keys(graph).length) {
    for (const [a, nbrs] of Object.entries(graph)) {
      for (const b of nbrs || []) edges.push([a, String(b)]);
    }
  } else {
    for (const e of edgesRaw) {
      if (Array.isArray(e) && e.length >= 2) edges.push([String(e[0]), String(e[1])]);
    }
  }

  return (
    <div className="flex h-full min-h-[220px] items-center justify-center">
      <svg width={320} height={260}>
        {edges.map(([a, b], i) => {
          const pa = byId.get(a);
          const pb = byId.get(b);
          if (!pa || !pb) return null;
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#94a3b8" strokeWidth={2} />;
        })}
        {pos.map((p) => {
          const isA = active.has(p.id);
          const isV = visited.has(p.id);
          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={22}
                fill={isA ? "#e0f2fe" : isV ? "#ecfdf5" : "#fff"}
                stroke={isA ? "#0284c7" : isV ? "#0d9488" : "#cbd5e1"}
                strokeWidth={2.5}
              />
              <text
                x={p.x}
                y={p.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-800 text-[12px] font-bold"
              >
                {p.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** AlgoMaster-style step visualizer (array / window / list / tree / graph / grid / dp). */
export const VISUAL_MODES = ["array", "window", "linkedlist", "tree", "graph", "dp", "grid"] as const;

export function VisualCanvas({ visual, event, fallbackSequence, caption, frameLabel }: Props) {
  const stickySequence = useRef<unknown[]>([]);
  const focus = useMemo(() => (event?.focus || {}) as Record<string, unknown>, [event]);
  const sequence = useMemo(() => {
    const parsed = parseSequence(focus, fallbackSequence);
    if (parsed.length) {
      stickySequence.current = parsed;
      return parsed;
    }
    if (stickySequence.current.length) return stickySequence.current;
    return parsed;
  }, [focus, fallbackSequence]);

  const pointers = useMemo(() => collectPointers(focus, sequence.length), [focus, sequence.length]);
  const stepText = caption || focusCaption(focus, visual);
  const mode = visual || "array";

  let body: ReactNode;
  if (mode === "grid" || focus.grid) {
    body = <GridViz focus={focus} />;
  } else if (mode === "tree" || focus.tree) {
    const vals = Array.isArray(focus.tree) ? (focus.tree as unknown[]) : sequence;
    body = <TreeViz values={vals} />;
  } else if (mode === "graph" || focus.graph || focus.edges) {
    body = <GraphViz focus={focus} />;
  } else if (mode === "linkedlist" || focus.list_head) {
    body = <LinkedListViz sequence={sequence} pointers={pointers} />;
  } else {
    body = (
      <ArrayViz sequence={sequence} pointers={pointers} windowMode={mode === "window" || mode === "dp"} />
    );
  }

  return (
    <div className="flex h-full min-h-[260px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
            Live visual · {mode}
          </p>
          <p className="truncate text-xs font-medium text-slate-600">{stepText}</p>
        </div>
        {frameLabel && (
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
            {frameLabel}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">{body}</div>
      {pointers.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white/80 px-3 py-2">
          {pointers.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.label} → index {p.index}
              {sequence[p.index] !== undefined ? ` (${String(sequence[p.index])})` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
