"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import {
  fetchPatterns,
  fetchProblems,
  fetchRoadmap,
  fetchSheets,
  type PatternInfo,
  type ProblemSummary,
  type SheetSummary,
  type Topic,
} from "@/lib/api";

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-600";
  if (x === "hard") return "text-rose-600";
  return "text-amber-600";
}

function statusLabel(p: ProblemSummary) {
  if (p.mastered) return "Mastered";
  if (p.stage >= 4) return "Viva";
  if (p.stage >= 3) return "Coding";
  if (p.stage >= 2) return "Predict";
  if (p.stage >= 1) return "Started";
  return "Todo";
}

function SheetInner() {
  const search = useSearchParams();
  const patternFilter = search.get("pattern") || "";
  const difficultyFilter = (search.get("difficulty") || "").toLowerCase();
  const statusFilter = search.get("status") || "";
  const topicFilter = search.get("topic") || "";

  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [patterns, setPatterns] = useState<PatternInfo[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    Promise.all([
      fetchProblems(topicFilter || undefined, patternFilter || undefined),
      fetchPatterns(),
      fetchRoadmap(),
      fetchSheets(),
    ])
      .then(([probs, pats, roadmap, sh]) => {
        setProblems(probs);
        setPatterns(pats);
        setTopics(roadmap.topics);
        setSheets(sh);
      })
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [patternFilter, topicFilter]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return problems.filter((p) => {
      if (difficultyFilter && p.difficulty.toLowerCase() !== difficultyFilter) return false;
      if (statusFilter === "mastered" && !p.mastered) return false;
      if (statusFilter === "todo" && (p.mastered || p.stage > 1)) return false;
      if (statusFilter === "in-progress" && (p.mastered || p.stage <= 1)) return false;
      if (needle && !`${p.title} ${p.pattern} ${p.topic}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [problems, difficultyFilter, statusFilter, q]);

  const mastered = problems.filter((p) => p.mastered).length;
  const activePattern = patterns.find((p) => p.id === patternFilter);

  function hrefWith(updates: Record<string, string | null>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `/problems?${s}` : "/problems";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Practice sheet</p>
          <h1 className="display mt-1 text-4xl font-extrabold">All problems</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            NeetCode-style list + TakeYouForward progress — open any row into the multi-agent loop (See → Predict → Code
            → Test → Viva).
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Mastered</p>
          <p className="display text-2xl font-extrabold tabular-nums">
            {mastered}
            <span className="text-base text-[var(--muted)]">/{problems.length || "—"}</span>
          </p>
        </div>
      </div>

      {sheets.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {sheets.map((s) => (
            <Link
              key={s.id}
              href={`/sheets/${s.id}`}
              className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-white to-teal-50/40 p-5 shadow-sm transition hover:border-teal-400/40"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Curated sheet</p>
              <h2 className="display mt-1 text-xl font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{s.subtitle}</p>
              <p className="mt-3 text-xs font-semibold text-[var(--ink)]">{s.problems_total} problems</p>
            </Link>
          ))}
          <Link
            href="/topics/two-pointers"
            className="rounded-2xl border border-[var(--ink)] bg-[var(--ink)] p-5 text-white shadow-sm transition hover:brightness-110"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200">Demo path</p>
            <h2 className="display mt-1 text-xl font-bold">Two Pointers + agents</h2>
            <p className="mt-1 text-sm text-white/70">Diagnose → plan → workspace coaches — professor walkthrough.</p>
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, pattern, topic…"
          className="h-10 min-w-[200px] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-teal-500"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "All difficulties", value: null },
          { label: "Easy", value: "easy" },
          { label: "Medium", value: "medium" },
          { label: "Hard", value: "hard" },
        ].map((d) => (
          <Link
            key={d.label}
            href={hrefWith({ difficulty: d.value })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              (difficultyFilter || null) === d.value
                ? "bg-[var(--ink)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {d.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { label: "All status", value: null },
          { label: "Todo", value: "todo" },
          { label: "In progress", value: "in-progress" },
          { label: "Mastered", value: "mastered" },
        ].map((s) => (
          <Link
            key={s.label}
            href={hrefWith({ status: s.value })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              (statusFilter || null) === s.value
                ? "bg-teal-600 text-white"
                : "border border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={hrefWith({ topic: null })}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            !topicFilter ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"
          }`}
        >
          All topics
        </Link>
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={hrefWith({ topic: t.slug })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              topicFilter === t.slug
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {t.title}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={hrefWith({ pattern: null })}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            !patternFilter ? "bg-slate-800 text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"
          }`}
        >
          All patterns
        </Link>
        {patterns.map((p) => (
          <Link
            key={p.id}
            href={hrefWith({ pattern: p.id })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              patternFilter === p.id
                ? "bg-slate-800 text-white"
                : "border border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {p.title}
          </Link>
        ))}
      </div>

      {activePattern && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Pattern: <strong className="text-[var(--ink)]">{activePattern.title}</strong>
        </p>
      )}

      {loading && <p className="mt-8 text-[var(--muted)]">Loading sheet…</p>}
      {error && <p className="mt-8 text-rose-700">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
          <div className="hidden grid-cols-[1fr_120px_140px_100px_90px] gap-3 border-b border-[var(--line)] bg-slate-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] sm:grid">
            <span>Problem</span>
            <span>Topic</span>
            <span>Pattern</span>
            <span>Difficulty</span>
            <span>Status</span>
          </div>
          <ul>
            {filtered.map((p) => (
              <li key={p.id} className="border-t border-[var(--line)] first:border-t-0">
                <Link
                  href={`/problems/${p.id}`}
                  className="grid grid-cols-1 items-center gap-1 px-4 py-3 transition hover:bg-teal-50/40 sm:grid-cols-[1fr_120px_140px_100px_90px] sm:gap-3"
                >
                  <span className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                    {p.mastered ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    {p.title}
                  </span>
                  <span className="text-xs text-[var(--muted)] sm:text-sm">{p.topic.replace(/-/g, " ")}</span>
                  <span className="truncate text-xs text-[var(--muted)] sm:text-sm">{p.pattern}</span>
                  <span className={`text-xs font-bold uppercase ${diffClass(p.difficulty)}`}>{p.difficulty}</span>
                  <span className="text-xs font-semibold text-[var(--muted)]">{statusLabel(p)}</span>
                </Link>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">No problems match these filters.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProblemsSheetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--muted)]">Loading sheet…</div>}>
      <SheetInner />
    </Suspense>
  );
}
