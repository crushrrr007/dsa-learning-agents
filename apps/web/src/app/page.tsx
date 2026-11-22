"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import {
  fetchPatterns,
  fetchProblems,
  fetchRoadmap,
  fetchRoadmapGraph,
  type PatternInfo,
  type ProblemSummary,
  type Roadmap,
  type RoadmapGraph,
  type Topic,
} from "@/lib/api";

const RoadmapGraphView = dynamic(
  () => import("@/components/roadmap/RoadmapGraph").then((m) => m.RoadmapGraph),
  { ssr: false },
);

function diffColor(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-600";
  if (x === "hard") return "text-rose-600";
  return "text-amber-600";
}

function HomeInner() {
  const search = useSearchParams();
  const patternFilter = search.get("pattern") || "";
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [graph, setGraph] = useState<RoadmapGraph | null>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [patterns, setPatterns] = useState<PatternInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([fetchRoadmap(), fetchRoadmapGraph(), fetchProblems(undefined, patternFilter || undefined), fetchPatterns()])
      .then(([r, g, p, pats]) => {
        setRoadmap(r);
        setGraph(g);
        setProblems(p);
        setPatterns(pats);
        const init: Record<string, boolean> = {};
        r.topics.forEach((t, i) => {
          init[t.slug] = i < 2 || Boolean(patternFilter);
        });
        setOpen(init);
      })
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [patternFilter]);

  const byTopic = useMemo(() => {
    const map = new Map<string, ProblemSummary[]>();
    for (const p of problems) {
      const list = map.get(p.topic) || [];
      list.push(p);
      map.set(p.topic, list);
    }
    return map;
  }, [problems]);

  const mastered = problems.filter((p) => p.mastered).length;
  const topicMap = useMemo(() => {
    const m = new Map<string, Topic>();
    roadmap?.topics.forEach((t) => m.set(t.slug, t));
    return m;
  }, [roadmap]);

  const topics = roadmap?.topics || [];
  const activePattern = patterns.find((p) => p.id === patternFilter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Pattern roadmap</p>
        <h1 className="display mt-2 text-3xl font-semibold sm:text-4xl">Pointer Lab</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
          Explore topics and patterns on your personal graph. Diagnose a topic, then practice LeetCode-style with
          distinct teaching agents. History feeds the knowledge graph for better plans.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md border border-[var(--line)] bg-white/80 px-3 py-1.5 font-medium">
            {mastered}/{problems.length || "—"} shown mastered
          </span>
          <Link
            href="/progress"
            className="rounded-md border border-[var(--line)] bg-white/80 px-3 py-1.5 font-medium hover:border-[var(--accent)]"
          >
            Progress
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--ink)]">Demo this: Two Pointers</p>
            <p className="text-xs text-[var(--muted)]">
              Diagnose → plan → overview → recommended problem → agents → reset.
            </p>
          </div>
          <Link
            href="/topics/two-pointers"
            className="inline-flex h-9 shrink-0 items-center rounded-md bg-[var(--accent)] px-3 text-xs font-bold text-white"
          >
            Start demo
          </Link>
        </div>
      </header>

      {loading && <div className="panel rounded-xl p-6 text-[var(--muted)]">Loading roadmap…</div>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          Could not reach the API on port 8417.
          <pre className="mt-2 text-xs opacity-80">{error}</pre>
        </div>
      )}

      {graph && (
        <section className="mb-8">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Your learning graph</h2>
              <p className="text-xs text-[var(--muted)]">
                Topics → patterns. Amber = weak, green = mastered, dashed = recommended. Click a node to open it.
              </p>
            </div>
          </div>
          <RoadmapGraphView graph={graph} />
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Explore patterns</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !patternFilter ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            All
          </Link>
          {patterns.map((pat) => (
            <Link
              key={pat.id}
              href={`/?pattern=${encodeURIComponent(pat.id)}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                patternFilter === pat.id
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
            >
              {pat.title} ({pat.problems_total})
            </Link>
          ))}
        </div>
        {activePattern && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Filtering by <strong>{activePattern.title}</strong> —{" "}
            <Link href="/" className="text-[var(--accent)] hover:underline">
              clear
            </Link>
          </p>
        )}
      </section>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Topics & problems</h2>
        {topics.map((topic) => {
          const list = byTopic.get(topic.slug) || [];
          if (patternFilter && list.length === 0) return null;
          const isOpen = open[topic.slug];
          return (
            <div key={topic.slug} className="overflow-hidden rounded-xl border border-[var(--line)] bg-white/90">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                onClick={() => setOpen((o) => ({ ...o, [topic.slug]: !isOpen }))}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: topic.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{topic.title}</span>
                    {topic.has_plan ? (
                      <span className="text-[11px] font-semibold text-emerald-600">Plan ready</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[var(--muted)]">No plan yet</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-[var(--muted)]">{topic.summary}</p>
                </div>
                <span className="text-xs font-medium text-[var(--muted)]">
                  {topic.problems_mastered}/{topic.problems_total}
                </span>
                <Link
                  href={`/topics/${topic.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/5"
                >
                  {topic.has_plan ? "Continue" : "Diagnose"}
                </Link>
                <span className="text-xs text-[var(--muted)]">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <ul className="border-t border-[var(--line)]">
                  {list.map((p) => (
                    <li key={p.id} className="border-t border-[var(--line)]/70 first:border-t-0">
                      <Link
                        href={`/problems/${p.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--accent)]/[0.04]"
                      >
                        {p.mastered ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                        )}
                        <span className="min-w-0 flex-1 font-medium">{p.title}</span>
                        <Link
                          href={`/?pattern=${encodeURIComponent(p.pattern_id || "")}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hidden rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)] sm:inline"
                        >
                          {p.pattern}
                        </Link>
                        <span className={`w-14 text-right text-xs font-bold uppercase ${diffColor(p.difficulty)}`}>
                          {p.difficulty}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--muted)]">Loading…</div>}>
      <HomeInner />
    </Suspense>
  );
}
