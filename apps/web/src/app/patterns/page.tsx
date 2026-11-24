"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Layers } from "lucide-react";
import { fetchPatterns, fetchProblems, type PatternInfo, type ProblemSummary } from "@/lib/api";

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<PatternInfo[]>([]);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    Promise.all([fetchPatterns(), fetchProblems()])
      .then(([pats, probs]) => {
        setPatterns(pats);
        setProblems(probs);
      })
      .catch((e) => setError(e.message || "Failed to load patterns"))
      .finally(() => setLoading(false));
  }, []);

  const masteredByPattern = useMemo(() => {
    const map = new Map<string, { mastered: number; total: number }>();
    for (const p of problems) {
      const key = p.pattern_id || p.pattern;
      const cur = map.get(key) || { mastered: 0, total: 0 };
      cur.total += 1;
      if (p.mastered) cur.mastered += 1;
      map.set(key, cur);
    }
    return map;
  }, [problems]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return patterns;
    return patterns.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.topics.some((t) => t.toLowerCase().includes(needle)),
    );
  }, [patterns, q]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Pattern explore</p>
          <h1 className="display mt-1 text-4xl font-extrabold">Think in patterns</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            AlgoMaster-style map of techniques — each pattern opens a filtered sheet, then the multi-agent loop
            (See → Predict → Code → Test → Viva).
          </p>
        </div>
        <Link
          href="/problems"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-bold shadow-sm transition hover:border-teal-400/40"
        >
          Full sheet <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search patterns or topics…"
          className="h-10 w-full max-w-md rounded-xl border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-teal-500"
        />
      </div>

      {loading && <p className="mt-8 text-[var(--muted)]">Loading patterns…</p>}
      {error && <p className="mt-8 text-rose-700">{error}</p>}

      {!loading && !error && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pat) => {
            const stats = masteredByPattern.get(pat.id) || {
              mastered: 0,
              total: pat.problems_total,
            };
            const pct = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
            return (
              <Link
                key={pat.id}
                href={`/problems?pattern=${encodeURIComponent(pat.id)}`}
                className="group flex flex-col rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <Layers className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold tabular-nums text-[var(--muted)]">
                    {stats.mastered}/{stats.total}
                  </span>
                </div>
                <h2 className="display mt-4 text-xl font-bold tracking-tight group-hover:text-teal-800">
                  {pat.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {pat.topics.map((t) => t.replace(/-/g, " ")).join(" · ") || "Cross-topic"}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-3 text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100">
                  Open sheet →
                </p>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-[var(--muted)]">No patterns match.</p>
          )}
        </div>
      )}
    </div>
  );
}
