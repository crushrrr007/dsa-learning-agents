"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { fetchProgress, type ProblemSummary, type Topic } from "@/lib/api";

export default function ProgressPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress()
      .then((p) => {
        setTopics(p.topics);
        setProblems(p.problems);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
  if (error) return <div className="mx-auto max-w-5xl px-4 py-12 text-red-700">{error}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Roadmap
      </Link>
      <h1 className="display mt-3 text-4xl font-semibold">Your progress</h1>
      <p className="mt-2 text-[var(--muted)]">Guest session mastery across Phase I and Phase II.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="panel rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Topics unlocked</p>
          <p className="display mt-2 text-3xl font-semibold">
            {totals.learned}/{totals.topics}
          </p>
        </div>
        <div className="panel rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Problems mastered</p>
          <p className="display mt-2 text-3xl font-semibold">
            {totals.mastered}/{totals.problems}
          </p>
        </div>
      </div>

      <section className="mt-10 space-y-4">
        {topics.map((t) => {
          const topicProblems = problems.filter((p) => p.topic === t.slug);
          return (
            <div key={t.slug} className="panel rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {t.learn_completed ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--good)]" />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--muted)]/50" />
                  )}
                  <div>
                    <h2 className="font-semibold">{t.title}</h2>
                    <p className="text-xs text-[var(--muted)]">
                      Phase {t.phase ?? 1} · {t.problems_mastered}/{t.problems_total} mastered
                    </p>
                  </div>
                </div>
                <Link href={`/topics/${t.slug}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">
                  Open topic →
                </Link>
              </div>
              <div className="mt-4 grid gap-2">
                {topicProblems.map((p) => (
                  <Link
                    key={p.id}
                    href={`/problems/${p.id}`}
                    className="flex items-center justify-between rounded-md bg-black/[0.03] px-3 py-2 text-sm hover:bg-black/[0.05]"
                  >
                    <span>
                      {p.title}
                      <span className="ml-2 text-xs uppercase text-[var(--muted)]">{p.difficulty}</span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {p.mastered ? "Mastered" : p.stage > 0 ? `Stage ${p.stage}` : t.learn_completed ? "Ready" : "Locked"}
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
