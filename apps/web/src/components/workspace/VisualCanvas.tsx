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

export function VisualCanvas({ visual, event, fallbackSequence }: Props) {
  const stickySequence = useRef<unknown[]>([]);
  const focus = useMemo(
    () => (event?.focus || {}) as Record<string, unknown>,
    [event],
  );
  const sequence = useMemo(() => {
    const parsed = parseSequence(focus, fallbackSequence);
    if (parsed.length) {
      stickySequence.current = parsed;
      return parsed;
    }
    // Keep last good sequence so empty early/late frames don't blank the canvas
    if (stickySequence.current.length) return stickySequence.current;
    return parsed;
  }, [focus, fallbackSequence]);
  const left =
    pointerIndex(focus, "left") ??
    pointerIndex(focus, "i") ??
    pointerIndex(focus, "slow") ??
    pointerIndex(focus, "write");
  const right =
    pointerIndex(focus, "right") ??
    pointerIndex(focus, "j") ??
    pointerIndex(focus, "fast") ??
    pointerIndex(focus, "curr");

  const built = useMemo(() => {
    if (visual === "linkedlist" || focus.list_head) {
      // Prefer explicit sequence for list values when available
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

    // array / window
    const nodes: Node[] = sequence.map((v, idx) => {
      const inWindow =
        left != null && right != null ? idx >= Math.min(left, right) && idx <= Math.max(left, right) : false;
      const isPtr = idx === left || idx === right;
      return {
        id: `c${idx}`,
        position: { x: 24 + idx * 72, y: 120 },
        data: { label: `${v}` },
        style: {
          width: 58,
          height: 58,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          border: `2px solid ${isPtr ? "#0b6e5f" : inWindow ? "#1d4e89" : "#14201c22"}`,
          background: isPtr ? "#0b6e5f18" : inWindow ? "#1d4e8914" : "#fff",
        },
      };
    });

    const labelNodes: Node[] = [];
    if (left != null && left >= 0 && left < sequence.length) {
      labelNodes.push({
        id: "left-label",
        position: { x: 24 + left * 72, y: 50 },
        data: { label: focus.left != null ? "L/i" : focus.slow != null ? "slow" : "ptr" },
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
