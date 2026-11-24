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
} from "@/lib/api";

const RoadmapGraphView = dynamic(
  () => import("@/components/roadmap/RoadmapGraph").then((m) => m.RoadmapGraph),
  { ssr: false },
);

const PILOT_TOPIC = "two-pointers";

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
    Promise.all([
      fetchRoadmap(),
      fetchRoadmapGraph(),
      fetchProblems(undefined, patternFilter || undefined),
      fetchPatterns(),
    ])
      .then(([r, g, p, pats]) => {
        setRoadmap(r);
        setGraph(g);
        setProblems(p);
        setPatterns(pats);
        const init: Record<string, boolean> = {};
        r.topics.forEach((t) => {
          init[t.slug] = t.slug === PILOT_TOPIC || Boolean(patternFilter);
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
  const topics = roadmap?.topics || [];
  const activePattern = patterns.find((p) => p.id === patternFilter);
  const pilotTopic = topics.find((t) => t.slug === PILOT_TOPIC);
  const pilotProblems = byTopic.get(PILOT_TOPIC) || [];
  const pilotNext =
    pilotProblems.find((p) => !p.mastered)?.id ||
    pilotTopic?.next_problem_id ||
    pilotProblems[0]?.id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="animate-rise mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Guest practice lab</p>
        <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">Pointer Lab</h1>
        <p className="mt-3 max-w-xl text-base text-[var(--muted)] sm:text-lg">
          Learn DSA by finishing one locked loop — See, Predict, Code, Test, Viva — with coaches that hint instead of
          dumping answers.
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-white via-white to-[var(--accent)]/10 shadow-[var(--shadow)]">
          <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
            <div className="p-5 sm:p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Start here</p>
              <h2 className="display mt-2 text-2xl font-semibold sm:text-3xl">Two Pointers pilot</h2>
              <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
                One topic. One door. Diagnose → soft plan → overview → recommended problem → finish the full stage loop.
              </p>
              <ol className="mt-4 grid gap-2 text-sm text-[var(--ink)] sm:grid-cols-5">
                {["Diagnose", "Plan", "Overview", "Practice", "Viva"].map((label, i) => (
                  <li
                    key={label}
                    className="rounded-lg border border-[var(--line)] bg-white/80 px-2.5 py-2 text-center text-xs font-semibold"
                  >
                    <span className="block text-[10px] font-bold text-[var(--accent)]">{i + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/topics/${PILOT_TOPIC}`}
                  className="inline-flex h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-bold text-white transition hover:brightness-110"
                >
                  {pilotTopic?.has_plan ? "Continue Two Pointers" : "Start Two Pointers"}
                </Link>
                {pilotNext && (
                  <Link
                    href={`/problems/${pilotNext}`}
                    className="inline-flex h-11 items-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
                  >
                    Jump to a problem
                  </Link>
                )}
              </div>
            </div>
            <div className="border-t border-[var(--line)] bg-[var(--accent)]/[0.06] p-5 md:border-l md:border-t-0 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Session</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {mastered}
                <span className="text-base font-medium text-[var(--muted)]">/{problems.length || "—"}</span>
              </p>
              <p className="text-sm text-[var(--muted)]">problems mastered this guest session</p>
              <Link
                href="/progress"
                className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Progress &amp; reset →
              </Link>
              <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
                Tip: if you get stuck, use Hint / Predict / Debug. Coaches are stage-aware and blocked from pasting full
                solutions.
              </p>
            </div>
          </div>
        </div>
      </header>

      {loading && <div className="panel rounded-xl p-6 text-[var(--muted)]">Loading roadmap…</div>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          Could not reach the API. Start it on port 8417, then refresh.
          <pre className="mt-2 text-xs opacity-80">{error}</pre>
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="animate-rise-delay mb-10">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">How a problem works</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Same five stages on every problem — viva unlocks only on a full test pass.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {[
                { n: "1", t: "See", d: "Watch the slow demo" },
                { n: "2", t: "Predict", d: "Name the next state" },
                { n: "3", t: "Code", d: "Editor unlocks" },
                { n: "4", t: "Test", d: "Examples + hidden" },
                { n: "5", t: "Viva", d: "Defend to master" },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-[var(--line)] bg-white/85 px-3 py-3">
                  <p className="text-[10px] font-bold text-[var(--accent)]">{s.n}</p>
                  <p className="font-semibold">{s.t}</p>
                  <p className="text-xs text-[var(--muted)]">{s.d}</p>
                </div>
              ))}
            </div>
          </section>

          {graph && (
            <section className="mb-8">
              <div className="mb-2">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Your learning graph</h2>
                <p className="text-xs text-[var(--muted)]">
                  Topics → patterns. Amber = weak, green = mastered. Optional — pilots can ignore this and use Start above.
                </p>
              </div>
              <RoadmapGraphView graph={graph} />
            </section>
          )}

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Explore patterns</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  !patternFilter ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"
                }`}
              >
                All
              </Link>
              {patterns.map((pat) => (
                <Link
                  key={pat.id}
                  href={`/?pattern=${encodeURIComponent(pat.id)}`}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
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
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">All topics</h2>
            {topics.map((topic) => {
              const list = byTopic.get(topic.slug) || [];
              if (patternFilter && list.length === 0) return null;
              const isOpen = open[topic.slug];
              const isPilot = topic.slug === PILOT_TOPIC;
              return (
                <div
                  key={topic.slug}
                  className={`overflow-hidden rounded-xl border bg-white/90 ${
                    isPilot ? "border-[var(--accent)]/40 ring-1 ring-[var(--accent)]/15" : "border-[var(--line)]"
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                    onClick={() => setOpen((o) => ({ ...o, [topic.slug]: !isOpen }))}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: topic.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{topic.title}</span>
                        {isPilot && (
                          <span className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--accent)]">
                            Pilot
                          </span>
                        )}
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
        </>
      )}
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
