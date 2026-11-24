"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { TOPIC_AGENTS, WORKSPACE_AGENTS } from "@/lib/agents";
import {
  fetchPatterns,
  fetchProblems,
  fetchRoadmap,
  type PatternInfo,
  type ProblemSummary,
  type Roadmap,
} from "@/lib/api";

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
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [patterns, setPatterns] = useState<PatternInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetchRoadmap(),
      fetchProblems(undefined, patternFilter || undefined),
      fetchPatterns(),
    ])
      .then(([r, p, pats]) => {
        setRoadmap(r);
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

  return (
    <div className="pb-16">
      <section className="mesh-hero relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-teal-400/30 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="animate-rise max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-100 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Multi-agent DSA · research showcase
            </p>
            <h1 className="display mt-5 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
              Pointer Lab
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Agentic DSA lab: personalized path, AlgoMaster-style visuals, and five coaches for See → Predict → Code →
              Test → Viva — the guided learning other platforms put behind a paywall, without dumping solutions.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/topics/${PILOT_TOPIC}`}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-teal-400 px-6 text-sm font-bold text-[#042f2e] transition hover:bg-teal-300"
              >
                {pilotTopic?.has_plan ? "Continue demo path" : "Try the multi-agent demo"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#agents"
                className="inline-flex h-12 items-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Meet the coaches
              </Link>
              <Link
                href="/problems"
                className="inline-flex h-12 items-center rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Practice sheet
              </Link>
            </div>
          </div>

          <div className="animate-rise-delay mt-10 grid gap-3 sm:grid-cols-5">
            {[
              { t: "See", d: "Demo Coach narrates the slow path" },
              { t: "Predict", d: "Predict Coach checks your next state" },
              { t: "Code", d: "Editor unlocks · Mentor on standby" },
              { t: "Test", d: "Failures feed Code Mentor" },
              { t: "Viva", d: "Viva Agent · mastery only if you defend" },
            ].map((s, i) => (
              <div
                key={s.t}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-200/80">0{i + 1}</p>
                <p className="mt-1 font-bold">{s.t}</p>
                <p className="mt-0.5 text-xs text-white/55">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {loading && (
          <div className="panel mt-8 rounded-2xl p-6 text-[var(--muted)]">Loading…</div>
        )}
        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            Could not reach the API.
            <pre className="mt-2 text-xs opacity-80">{error}</pre>
          </div>
        )}

        {!loading && !error && (
          <>
            <section id="agents" className="animate-rise-late mt-12 scroll-mt-20">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Why multi-agent</p>
                  <h2 className="display mt-1 text-3xl font-bold">Five coaches, one learning loop</h2>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                    A single chatbot tries to do everything and often pastes answers. Pointer Lab routes you to a
                    specialist per stage — then a solution guard blocks full dumps.
                  </p>
                </div>
                <p className="text-xs font-semibold tabular-nums text-[var(--muted)]">
                  {mastered}/{problems.length} mastered this session
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {WORKSPACE_AGENTS.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm"
                    style={{ borderTopColor: a.accent, borderTopWidth: 3 }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black text-white"
                        style={{ background: a.accent }}
                      >
                        {a.letter}
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: a.accent }}>
                          {a.stage}
                        </p>
                        <h3 className="font-bold text-[var(--ink)]">{a.title}</h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{a.job}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      <span className="font-semibold text-[var(--ink)]">When: </span>
                      {a.when}
                    </p>
                  </div>
                ))}
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-slate-50/80 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Plus on topic entry</p>
                  <h3 className="mt-1 font-bold text-[var(--ink)]">Diagnose · Plan · Teach</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    {TOPIC_AGENTS.map((a) => (
                      <li key={a.id}>
                        <span className="font-semibold text-[var(--ink)]">{a.title}: </span>
                        {a.job}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/topics/${PILOT_TOPIC}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] hover:underline"
                  >
                    Run demo path <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </section>

            <section className="mt-12">
              <h2 className="display text-2xl font-bold">Patterns</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Filter by idea, then open a problem into the agent loop.{" "}
                <Link href="/patterns" className="font-semibold text-[var(--accent)] hover:underline">
                  Full pattern map
                </Link>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/"
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    !patternFilter
                      ? "bg-[var(--ink)] text-white"
                      : "border border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]"
                  }`}
                >
                  All
                </Link>
                {patterns.map((pat) => (
                  <Link
                    key={pat.id}
                    href={`/?pattern=${encodeURIComponent(pat.id)}`}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      patternFilter === pat.id
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {pat.title}
                    <span className="ml-1 opacity-60">{pat.problems_total}</span>
                  </Link>
                ))}
              </div>
              {activePattern && (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Showing <strong className="text-[var(--ink)]">{activePattern.title}</strong> —{" "}
                  <Link href="/" className="font-semibold text-[var(--accent)] hover:underline">
                    clear filter
                  </Link>
                </p>
              )}
            </section>

            <section className="mt-10">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="display text-2xl font-bold">Practice sheet</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Expand a topic or start diagnose → plan. Every problem opens with coaches.
                  </p>
                </div>
                <p className="text-xs font-semibold tabular-nums text-[var(--muted)]">
                  {problems.length} problems · {topics.length} topics
                </p>
              </div>

              <div className="space-y-2.5">
                {topics.map((topic) => {
                  const list = byTopic.get(topic.slug) || [];
                  if (patternFilter && list.length === 0) return null;
                  const isOpen = open[topic.slug];
                  const isPilot = topic.slug === PILOT_TOPIC;
                  const pct = topic.problems_total
                    ? Math.round((topic.problems_mastered / topic.problems_total) * 100)
                    : 0;
                  return (
                    <div
                      key={topic.slug}
                      className={`sheet-row overflow-hidden rounded-2xl border bg-white/95 ${
                        isPilot ? "border-teal-500/40 shadow-[0_0_0_1px_rgba(20,184,166,0.12)]" : "border-[var(--line)]"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                        onClick={() => setOpen((o) => ({ ...o, [topic.slug]: !isOpen }))}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-4 ring-black/[0.03]"
                          style={{ background: topic.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[var(--ink)]">{topic.title}</span>
                            {isPilot && (
                              <span className="rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                                Demo
                              </span>
                            )}
                            {topic.has_plan ? (
                              <span className="text-[11px] font-semibold text-emerald-600">Plan ready</span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{topic.summary}</p>
                          <div className="mt-2.5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="hidden text-xs font-bold tabular-nums text-[var(--muted)] sm:inline">
                          {topic.problems_mastered}/{topic.problems_total}
                        </span>
                        <Link
                          href={`/topics/${topic.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition hover:bg-teal-50"
                        >
                          {topic.has_plan ? "Continue" : "Start"}
                        </Link>
                        <span className="text-sm text-[var(--muted)]">{isOpen ? "▾" : "▸"}</span>
                      </button>
                      {isOpen && (
                        <ul className="border-t border-[var(--line)] bg-slate-50/60">
                          {list.map((p) => (
                            <li key={p.id} className="border-t border-[var(--line)]/60 first:border-t-0">
                              <Link
                                href={`/problems/${p.id}`}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-white sm:px-5"
                              >
                                {p.mastered ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                ) : (
                                  <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                                )}
                                <span className="min-w-0 flex-1 font-medium">{p.title}</span>
                                <span
                                  className={`w-14 text-right text-[11px] font-bold uppercase tracking-wide ${diffColor(p.difficulty)}`}
                                >
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
            </section>
          </>
        )}
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
