"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { fetchProblems, fetchRoadmap, type ProblemSummary, type Roadmap, type Topic } from "@/lib/api";

function diffColor(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-600";
  if (x === "hard") return "text-rose-600";
  return "text-amber-600";
}

export default function HomePage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([fetchRoadmap(), fetchProblems()])
      .then(([r, p]) => {
        setRoadmap(r);
        setProblems(p);
        const init: Record<string, boolean> = {};
        r.topics.forEach((t, i) => {
          init[t.slug] = i < 2;
        });
        setOpen(init);
      })
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

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

  const phases =
    roadmap?.phases?.length
      ? roadmap.phases
      : [
          {
            id: 1,
            title: "Phase I — Linear structures",
            topic_slugs: roadmap?.topics.filter((t) => (t.phase ?? 1) === 1).map((t) => t.slug) || [],
          },
          {
            id: 2,
            title: "Phase II — Trees, Graphs & DP",
            topic_slugs: roadmap?.topics.filter((t) => t.phase === 2).map((t) => t.slug) || [],
          },
        ];

  const topicMap = useMemo(() => {
    const m = new Map<string, Topic>();
    roadmap?.topics.forEach((t) => m.set(t.slug, t));
    return m;
  }, [roadmap]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">DSA practice roadmap</p>
        <h1 className="display mt-2 text-3xl font-semibold sm:text-4xl">Pointer Lab</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
          NeetCode-style problem list. Open a problem → code like LeetCode → call built-in agents (Hint, Demo, Predict,
          Debug, Viva) instead of reading solution dumps.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md border border-[var(--line)] bg-white/80 px-3 py-1.5 font-medium">
            {mastered}/{problems.length || 20} mastered
          </span>
          <Link href="/progress" className="rounded-md border border-[var(--line)] bg-white/80 px-3 py-1.5 font-medium hover:border-[var(--accent)]">
            Progress
          </Link>
        </div>
      </header>

      {loading && <div className="panel rounded-xl p-6 text-[var(--muted)]">Loading problem set…</div>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          Could not reach the API on port 8417.
          <pre className="mt-2 text-xs opacity-80">{error}</pre>
        </div>
      )}

      <div className="space-y-8">
        {phases.map((phase) => {
          const topics = phase.topic_slugs.map((s) => topicMap.get(s)).filter(Boolean) as Topic[];
          return (
            <section key={phase.id}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{phase.title}</h2>
              <div className="space-y-3">
                {topics.map((topic) => {
                  const list = byTopic.get(topic.slug) || [];
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
                            {topic.learn_completed ? (
                              <span className="text-[11px] font-semibold text-emerald-600">Lesson done</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-600">Lesson locked problems</span>
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
                          Lesson
                        </Link>
                        <span className="text-xs text-[var(--muted)]">{isOpen ? "▾" : "▸"}</span>
                      </button>

                      {isOpen && (
                        <ul className="border-t border-[var(--line)]">
                          {list.length === 0 && (
                            <li className="px-4 py-3 text-sm text-[var(--muted)]">No problems yet.</li>
                          )}
                          {list.map((p) => {
                            const locked = p.stage === 0 && !topic.learn_completed;
                            return (
                              <li key={p.id} className="border-t border-[var(--line)]/70 first:border-t-0">
                                <Link
                                  href={`/problems/${p.id}`}
                                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--accent)]/[0.04]"
                                >
                                  {p.mastered ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                  ) : locked ? (
                                    <Lock className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                                  ) : (
                                    <Circle className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                                  )}
                                  <span className="min-w-0 flex-1 font-medium">{p.title}</span>
                                  <span className="hidden text-xs text-[var(--muted)] sm:inline">{p.pattern}</span>
                                  <span className={`w-14 text-right text-xs font-bold uppercase ${diffColor(p.difficulty)}`}>
                                    {p.difficulty}
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
