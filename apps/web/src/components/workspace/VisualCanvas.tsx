"use client";

import { useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import type { TraceEvent } from "@/lib/api";

type Props = {
  visual: string;
  event: TraceEvent | null;
  fallbackSequence?: unknown;
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

function layoutTree(values: unknown[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (!values.length) {
    return {
      nodes: [
        {
          id: "empty",
          position: { x: 80, y: 100 },
          data: { label: "empty tree" },
          style: { padding: 12, borderRadius: 8, border: "1px dashed #14201c44" },
        },
      ],
      edges,
    };
  }
  const positions: Record<number, { x: number; y: number }> = { 0: { x: 260, y: 30 } };
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null || values[i] === undefined) continue;
    const depth = Math.floor(Math.log2(i + 1));
    const indexInLevel = i - (2 ** depth - 1);
    const levelCount = 2 ** depth;
    const y = 30 + depth * 85;
    const x = 40 + ((indexInLevel + 0.5) / levelCount) * 480;
    positions[i] = { x, y };
    nodes.push({
      id: `t${i}`,
      position: { x, y },
      data: { label: String(values[i]) },
      style: {
        width: 48,
        height: 48,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #047857",
        background: "#ecfdf5",
        fontWeight: 700,
      },
    });
    if (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (values[parent] !== null && values[parent] !== undefined) {
        edges.push({
          id: `te${parent}-${i}`,
          source: `t${parent}`,
          target: `t${i}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#04785799" },
        });
      }
    }
  }
  return { nodes, edges };
}

function layoutGraph(focus: Record<string, unknown>): { nodes: Node[]; edges: Edge[] } {
  const graph = (focus.graph || {}) as Record<string, unknown[]>;
  const edgesRaw = (focus.edges || []) as unknown[];
  const seen = new Set<string>();
  const nodeIds: string[] = [];
  Object.keys(graph).forEach((k) => {
    if (!seen.has(k)) {
      seen.add(k);
      nodeIds.push(k);
    }
    for (const v of graph[k] || []) {
      const id = String(v);
      if (!seen.has(id)) {
        seen.add(id);
        nodeIds.push(id);
      }
    }
  });
  for (const e of edgesRaw) {
    if (Array.isArray(e) && e.length >= 2) {
      for (const x of e.slice(0, 2)) {
        const id = String(x);
        if (!seen.has(id)) {
          seen.add(id);
          nodeIds.push(id);
        }
      }
    }
  }
  if (!nodeIds.length && focus.n != null) {
    const n = Number(String(focus.n).replace(/['"]/g, ""));
    if (Number.isFinite(n)) {
      for (let i = 0; i < Math.min(n, 12); i++) nodeIds.push(String(i));
    }
  }
  const active = new Set(
    [focus.u, focus.v, focus.src, focus.dst]
      .filter((x) => x != null)
      .map((x) => String(x).replace(/['"]/g, "")),
  );
  const visited = new Set(
    (Array.isArray(focus.seen) ? focus.seen : []).map((x) => String(x)),
  );
  const nodes: Node[] = nodeIds.map((id, idx) => ({
    id: `g${id}`,
    position: {
      x: 60 + (idx % 4) * 110,
      y: 40 + Math.floor(idx / 4) * 100,
    },
    data: { label: id },
    style: {
      width: 48,
      height: 48,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      border: `2px solid ${active.has(id) ? "#0369a1" : visited.has(id) ? "#0b6e5f" : "#14201c33"}`,
      background: active.has(id) ? "#e0f2fe" : visited.has(id) ? "#ecfdf5" : "#fff",
    },
  }));
  const edges: Edge[] = [];
  const addEdge = (a: string, b: string, i: number) => {
    edges.push({
      id: `ge${i}-${a}-${b}`,
      source: `g${a}`,
      target: `g${b}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#0369a199" },
    });
  };
  let ei = 0;
  if (Object.keys(graph).length) {
    for (const [a, nbrs] of Object.entries(graph)) {
      for (const b of nbrs || []) {
        addEdge(a, String(b), ei++);
      }
    }
  } else {
    for (const e of edgesRaw) {
      if (Array.isArray(e) && e.length >= 2) addEdge(String(e[0]), String(e[1]), ei++);
    }
  }
  if (!nodes.length) {
    nodes.push({
      id: "hint",
      position: { x: 40, y: 100 },
      data: { label: "Run code to stream graph frames" },
      style: { padding: 14, borderRadius: 10, border: "1px dashed #14201c44", background: "#fff", width: 280 },
    });
  }
  return { nodes, edges };
}

export function VisualCanvas({ visual, event, fallbackSequence }: Props) {
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
  const left =
    pointerIndex(focus, "left") ??
    pointerIndex(focus, "i") ??
    pointerIndex(focus, "slow") ??
    pointerIndex(focus, "write") ??
    pointerIndex(focus, "u");
  const right =
    pointerIndex(focus, "right") ??
    pointerIndex(focus, "j") ??
    pointerIndex(focus, "fast") ??
    pointerIndex(focus, "curr") ??
    pointerIndex(focus, "v");

  const built = useMemo(() => {
    if (visual === "tree" || focus.tree) {
      const vals = Array.isArray(focus.tree) ? (focus.tree as unknown[]) : sequence;
      return layoutTree(vals);
    }
    if (visual === "graph" || focus.graph || focus.edges) {
      return layoutGraph(focus);
    }

    if (visual === "linkedlist" || focus.list_head) {
      const vals = sequence.length
        ? sequence
        : Array.isArray(fallbackSequence)
          ? (fallbackSequence as unknown[])
          : [];
      const nodes: Node[] = vals.map((v, idx) => ({
        id: `n${idx}`,
        position: { x: 40 + idx * 130, y: 110 },
        data: { label: String(v) },
        style: {
          borderRadius: 999,
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${idx === left || idx === right ? "#0b6e5f" : "#14201c33"}`,
          background: idx === left || idx === right ? "#0b6e5f14" : "#fff",
          fontWeight: 700,
        },
      }));
      const edges: Edge[] = vals.slice(0, -1).map((_, idx) => ({
        id: `e${idx}`,
        source: `n${idx}`,
        target: `n${idx + 1}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#14201c66" },
      }));
      if (!nodes.length) {
        nodes.push({
          id: "empty",
          position: { x: 80, y: 100 },
          data: { label: "empty" },
          style: { padding: 12, borderRadius: 8, border: "1px dashed #14201c44" },
        });
      }
      return { nodes, edges };
    }

    // array / window / dp table
    const nodes: Node[] = sequence.map((v, idx) => {
      const inWindow =
        left != null && right != null ? idx >= Math.min(left, right) && idx <= Math.max(left, right) : false;
      const isPtr = idx === left || idx === right;
      const isDp = visual === "dp" || focus.dp != null;
      return {
        id: `c${idx}`,
        position: { x: 24 + idx * 72, y: 120 },
        data: { label: isDp ? `${idx}:${v}` : `${v}` },
        style: {
          width: isDp ? 64 : 58,
          height: 58,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: isDp ? 12 : 14,
          border: `2px solid ${isPtr ? "#9a3412" : inWindow ? "#1d4e89" : "#14201c22"}`,
          background: isPtr ? "#fff7ed" : inWindow ? "#1d4e8914" : "#fff",
        },
      };
    });

    const labelNodes: Node[] = [];
    if (left != null && left >= 0 && left < sequence.length) {
      labelNodes.push({
        id: "left-label",
        position: { x: 24 + left * 72, y: 50 },
        data: {
          label:
            focus.left != null ? "L/i" : focus.slow != null ? "slow" : visual === "dp" ? "i" : "ptr",
        },
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "#0b6e5f",
          border: "none",
          background: "transparent",
          width: 58,
          textAlign: "center",
        },
      });
    }
    if (right != null && right >= 0 && right < sequence.length && right !== left) {
      labelNodes.push({
        id: "right-label",
        position: { x: 24 + right * 72, y: 50 },
        data: { label: focus.right != null ? "R" : focus.fast != null ? "fast" : "ptr" },
        style: {
          fontSize: 12,
          fontWeight: 700,
          color: "#1d4e89",
          border: "none",
          background: "transparent",
          width: 58,
          textAlign: "center",
        },
      });
    }

    if (!nodes.length) {
      nodes.push({
        id: "hint",
        position: { x: 40, y: 100 },
        data: { label: "Run code to stream trace frames" },
        style: {
          padding: 14,
          borderRadius: 10,
          border: "1px dashed #14201c44",
          background: "#fff",
          width: 280,
        },
      });
    }

    return { nodes: [...nodes, ...labelNodes], edges: [] as Edge[] };
  }, [visual, sequence, left, right, focus, fallbackSequence]);

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built, setNodes, setEdges]);

  return (
    <div className="h-full min-h-[260px] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[#f7faf8]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} color="#14201c14" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
