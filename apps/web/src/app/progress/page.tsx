"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchProgress, resetProgress, type ProblemSummary, type Topic } from "@/lib/api";

export default function ProgressPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = await fetchProgress();
      setTopics(p.topics);
      setProblems(p.problems);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onReset() {
    if (!confirm("Reset plans + mastery for this guest session? Use before a fresh professor demo.")) return;
    setResetting(true);
    setResetMsg(null);
    try {
      const res = await resetProgress();
      setTopics(res.progress.topics);
      setProblems(res.progress.problems);
      setResetMsg("Session cleared. Ready for a fresh demo path.");
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const totals = useMemo(() => {
    const mastered = problems.filter((p) => p.mastered).length;
    const learned = topics.filter((t) => t.learn_completed).length;
    return {
      mastered,
      problems: problems.length,
      learned,
      topics: topics.length,
    };
  }, [problems, topics]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-12 text-[var(--muted)]">Loading progress…</div>;
  if (error) return <div className="mx-auto max-w-5xl px-4 py-12 text-rose-700">{error}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)] hover:underline">
        ← Practice sheet
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-extrabold sm:text-5xl">Progress</h1>
          <p className="mt-2 max-w-lg text-[var(--muted)]">
            Guest session mastery. Reset before each professor demo so the Two Pointers path starts clean.
          </p>
        </div>
        <Button variant="secondary" onClick={onReset} disabled={resetting}>
          {resetting ? "Resetting…" : "Reset session"}
        </Button>
      </div>
      {resetMsg && (
        <p className={`mt-4 text-sm ${resetMsg.includes("fail") ? "text-rose-700" : "text-emerald-700"}`}>
          {resetMsg}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Overviews done</p>
          <p className="display mt-2 text-4xl font-extrabold tabular-nums">
            {totals.learned}
            <span className="text-xl font-semibold text-[var(--muted)]">/{totals.topics}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Problems mastered</p>
          <p className="display mt-2 text-4xl font-extrabold tabular-nums">
            {totals.mastered}
            <span className="text-xl font-semibold text-[var(--muted)]">/{totals.problems}</span>
          </p>
        </div>
      </div>

      <section className="mt-10 space-y-3">
        {topics.map((t) => {
          const topicProblems = problems.filter((p) => p.topic === t.slug);
          const pct = t.problems_total ? Math.round((t.problems_mastered / t.problems_total) * 100) : 0;
          return (
            <div key={t.slug} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {t.learn_completed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0">
                    <h2 className="font-bold">{t.title}</h2>
                    <p className="text-xs text-[var(--muted)]">
                      {t.problems_mastered}/{t.problems_total} mastered
                      {t.has_plan ? " · plan ready" : ""}
                    </p>
                    <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <Link
                  href={`/topics/${t.slug}`}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-bold text-[var(--accent)] hover:bg-teal-50"
                >
                  Open topic →
                </Link>
              </div>
              <div className="border-t border-[var(--line)] bg-slate-50/70 px-3 py-2">
                {topicProblems.map((p) => (
                  <Link
                    key={p.id}
                    href={`/problems/${p.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-white"
                  >
                    <span className="font-medium">
                      {p.title}
                      <span className="ml-2 text-[11px] font-bold uppercase text-[var(--muted)]">{p.difficulty}</span>
                    </span>
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {p.mastered ? "Mastered" : p.stage > 0 ? `Stage ${p.stage}` : "Ready"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
