"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  MarkerType,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

export type GraphPayload = {
  nodes: {
    id: string;
    kind: string;
    label: string;
    slug?: string;
    pattern_id?: string;
    color?: string;
    status?: string;
    position: { x: number; y: number };
    problems_total?: number;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    rel: string;
    style?: string;
  }[];
};

function statusBorder(status?: string) {
  if (status === "mastered") return "#1f7a4c";
  if (status === "weak") return "#b45309";
  if (status === "recommended") return "#0b6e5f";
  return "rgba(20,32,28,0.18)";
}

function TopicNode({ data }: { data: { label: string; color: string; status?: string } }) {
  return (
    <div
      className="rounded-xl border-2 bg-white px-3 py-2 text-center shadow-sm"
      style={{ borderColor: statusBorder(data.status), minWidth: 110 }}
    >
      <div className="mx-auto mb-1 h-2 w-2 rounded-full" style={{ background: data.color }} />
      <div className="text-xs font-bold text-[var(--ink)]">{data.label}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Topic</div>
    </div>
  );
}

function PatternNode({
  data,
}: {
  data: { label: string; status?: string; problems_total?: number };
}) {
  return (
    <div
      className="rounded-lg border bg-[#f7faf8] px-2.5 py-1.5 text-center shadow-sm"
      style={{ borderColor: statusBorder(data.status), minWidth: 100 }}
    >
      <div className="text-[11px] font-semibold text-[var(--ink)]">{data.label}</div>
      <div className="text-[10px] text-[var(--muted)]">
        Pattern · {data.problems_total ?? 0}
        {data.status && data.status !== "default" ? ` · ${data.status}` : ""}
      </div>
    </div>
  );
}

const nodeTypes = { topic: TopicNode, pattern: PatternNode };

export function RoadmapGraph({ graph }: { graph: GraphPayload }) {
  const router = useRouter();

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.kind === "topic" ? "topic" : "pattern",
        position: n.position,
        data: {
          label: n.label,
          color: n.color || "#0b6e5f",
          status: n.status,
          problems_total: n.problems_total,
          slug: n.slug,
          pattern_id: n.pattern_id,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      })),
    [graph.nodes],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => {
        const style = e.style || "solid";
        let stroke = "rgba(20,32,28,0.25)";
        let dash: string | undefined;
        if (style === "dashed" || style === "recommended") {
          stroke = "#0b6e5f";
          dash = "6 4";
        } else if (style === "weak") {
          stroke = "#b45309";
          dash = "4 4";
        } else if (style === "mastered") {
          stroke = "#1f7a4c";
        }
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: style === "recommended",
          style: { stroke, strokeWidth: 1.5, strokeDasharray: dash },
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
        };
      }),
    [graph.edges],
  );

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-white/90 sm:h-[480px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.45}
        maxZoom={1.4}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          const d = node.data as { slug?: string; pattern_id?: string; kind?: string };
          if (node.type === "topic" && d.slug) {
            router.push(`/topics/${d.slug}`);
            return;
          }
          if (node.type === "pattern" && d.pattern_id) {
            router.push(`/practice?pattern=${encodeURIComponent(d.pattern_id)}`);
          }
        }}
      >
        <Background gap={18} size={1} color="rgba(20,32,28,0.08)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
