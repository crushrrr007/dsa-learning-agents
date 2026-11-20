"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { fetchRoadmap, type Roadmap, type Topic } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoadmap()
      .then(setRoadmap)
      .catch((e) => setError(e.message || "Failed to load roadmap"))
      .finally(() => setLoading(false));
  }, []);

  const bySlug = useMemo(() => {
    const map = new Map<string, Topic>();
    roadmap?.topics.forEach((t) => map.set(t.slug, t));
    return map;
  }, [roadmap]);

  const phases =
    roadmap?.phases?.length
      ? roadmap.phases
      : [
          { id: 1, title: "Phase I", topic_slugs: roadmap?.topics.filter((t) => (t.phase ?? 1) === 1).map((t) => t.slug) || [] },
          { id: 2, title: "Phase II", topic_slugs: roadmap?.topics.filter((t) => t.phase === 2).map((t) => t.slug) || [] },
        ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="animate-rise relative overflow-hidden rounded-2xl panel px-6 py-10 sm:px-10 sm:py-14">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--accent)]/10 blur-2xl animate-pulse-soft" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-[var(--accent-2)]/10 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Multi-agent learning workspace
        </p>
        <h1 className="display mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl">
          Pointer Lab
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          {roadmap?.description ||
            "Learn DSA with real code tracing and teaching agents — from arrays through trees, graphs, and DP."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => document.getElementById("roadmap")?.scrollIntoView({ behavior: "smooth" })}>
            Open full roadmap
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Link
            href="/progress"
            className="inline-flex h-10 items-center rounded-md border border-[var(--line)] bg-white/80 px-4 text-sm font-semibold text-[var(--ink)] hover:bg-white"
          >
            View progress
          </Link>
        </div>
      </section>

      <section id="roadmap" className="animate-rise-delay mt-12 space-y-10">
        {loading && <div className="panel rounded-xl p-8 text-[var(--muted)]">Loading roadmap…</div>}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            Could not reach the API. Start the backend on port 8417.
            <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{error}</pre>
          </div>
        )}

        {phases.map((phase) => {
          let topics = phase.topic_slugs.map((s) => bySlug.get(s)).filter(Boolean) as Topic[];
          if (!topics.length && roadmap) {
            topics = roadmap.topics.filter((t) => (t.phase ?? 1) === phase.id);
          }
          return (
            <div key={phase.id}>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Phase {phase.id}
                </p>
                <h2 className="display mt-1 text-3xl font-semibold">{phase.title}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {topics.map((topic, idx) => {
                  const done = topic.learn_completed;
                  return (
                    <Link
                      key={topic.slug}
                      href={`/topics/${topic.slug}`}
                      className="group panel rounded-xl p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/40"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: topic.color }}
                            />
                            Step {topic.order}
                          </div>
                          <h3 className="display mt-2 text-2xl font-semibold">{topic.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{topic.summary}</p>
                        </div>
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--good)]" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-[var(--muted)]/50" />
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-between text-sm">
                        <span className="text-[var(--muted)]">
                          {topic.problems_mastered}/{topic.problems_total} mastered
                        </span>
                        <span className="font-semibold text-[var(--accent)] group-hover:underline">
                          {done ? "Practice problems" : "Learn concept"} →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
