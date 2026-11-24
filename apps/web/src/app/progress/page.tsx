"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { LearningLink, LoadState, PageHeading, ProblemStatus } from "@/components/learning/shared";
import { fetchProgress, resetProgress } from "@/lib/api";

export default function ProgressPage() {
  const { data, error, mutate } = useSWR("learning-progress", fetchProgress, { revalidateOnMount: true });
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function onReset() {
    if (!confirm("Clear this browser’s guest progress? This removes plans, attempts, and mastery.")) return;
    setResetting(true);
    setResetMsg(null);
    try {
      await resetProgress();
      await mutate();
      setResetMsg("Guest progress cleared.");
    } catch (cause) {
      setResetMsg(cause instanceof Error ? cause.message : "Could not reset progress. Try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="learn-main">
      <PageHeading label="Your study desk" title="Your progress" copy="Solved means your code passed the tests. Mastered means you also explained your approach in Viva." />
      {!data ? <LoadState error={error} retry={() => void mutate()} loading="Loading your progress…" /> : (
        <>
          <section className="learn-panel today-progress" aria-label="Session totals">
            <div className="today-progress-title"><div><h2 className="font-serif">Guest session</h2><p>Saved for this browser.</p></div></div>
            <dl className="today-counts">
              <div><dt>Overviews done</dt><dd>{data.topics.filter((topic) => topic.learn_completed).length}<span>/{data.topics.length}</span></dd></div>
              <div><dt>Solved</dt><dd>{data.problems.filter((problem) => problem.solved).length}<span>/{data.problems.length}</span></dd></div>
              <div><dt>Mastered</dt><dd>{data.problems.filter((problem) => problem.mastered).length}<span>/{data.problems.length}</span></dd></div>
            </dl>
            <LearningLink href="/">Back to Today</LearningLink>
          </section>
          <section className="learn-chapters" aria-labelledby="progress-by-chapter">
            <div className="learn-section-heading"><h2 id="progress-by-chapter" className="font-serif">Progress by chapter</h2></div>
            {[...data.topics].sort((a, b) => a.order - b.order).map((topic) => (
              <details key={topic.slug} className="learn-panel progress-chapter">
                <summary><span>{topic.title}</span><span>{topic.problems_mastered}/{topic.problems_total} mastered</span></summary>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3"><progress className="w-40 max-w-full accent-[var(--accent)]" max={Math.max(topic.problems_total, 1)} value={topic.problems_mastered} aria-label={`${topic.title} mastery`} /><LearningLink href={`/topics/${topic.slug}`}>Open chapter</LearningLink></div>
                <ul className="progress-problems">
                  {data.problems.filter((problem) => problem.topic === topic.slug).map((problem) => (
                    <li key={problem.id}><Link href={`/problems/${problem.id}`}><span>{problem.title}</span><ProblemStatus problem={problem} /></Link></li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void onReset()} disabled={resetting} className="learn-text-link">{resetting ? "Clearing progress…" : "Reset guest progress"}</button>
            {resetMsg && <span role="status" className="text-sm text-[var(--muted)]">{resetMsg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
