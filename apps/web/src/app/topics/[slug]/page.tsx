"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChapterNotes } from "@/components/learning/ChapterNotes";
import { LearningLink, LoadState, PageHeading, Prerequisites, ProblemStatus } from "@/components/learning/shared";
import { Button } from "@/components/ui/button";
import {
  completeTopicOverview,
  fetchDiagnostic,
  fetchProblems,
  fetchTopicLearn,
  fetchTopicOverview,
  fetchTopicPlan,
  submitDiagnostic,
  type MicroReview,
  type ProblemSummary,
  type TopicPlan,
} from "@/lib/api";

type Step = "lesson" | "diagnose" | "plan" | "overview" | "practice";

const STEPS: { id: Step; label: string }[] = [
  { id: "lesson", label: "Lesson" },
  { id: "diagnose", label: "Diagnostic" },
  { id: "plan", label: "Your plan" },
  { id: "overview", label: "Overview" },
  { id: "practice", label: "Practice" },
];

function badgeLabel(b?: string | null) {
  if (b === "review_first") return "Review first";
  if (b === "optional") return "Optional";
  if (b === "recommended") return "Recommended";
  return null;
}

function badgeClass(b?: string | null) {
  if (b === "review_first") return "bg-amber-100 text-amber-800";
  if (b === "optional") return "bg-slate-100 text-slate-600";
  if (b === "recommended") return "bg-emerald-100 text-emerald-800";
  return "bg-black/5 text-[var(--muted)]";
}

function BeforeYouCode({ reviews }: { reviews: MicroReview[] }) {
  if (!reviews.length) return null;
  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-4">
      <h3 className="text-sm font-bold text-amber-950">Before you code</h3>
      <p className="mt-1 text-xs text-amber-900/80">
        Micro-reviews from your diagnostic misses — skim these, then open the recommended problem.
      </p>
      <ul className="mt-3 space-y-3">
        {reviews.map((r) => (
          <li key={r.skill} className="rounded-md border border-amber-200/60 bg-white/80 px-3 py-2">
            <p className="text-sm font-semibold text-[var(--ink)]">{r.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{r.blurb}</p>
            {r.prereq_topic ? (
              <Link
                href={`/topics/${r.prereq_topic}`}
                className="mt-2 inline-block text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Open {r.prereq_topic.replace(/-/g, " ")} lesson →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function loadChapter(slug: string) {
  const [diagnostic, plan, problems, lesson] = await Promise.all([
    fetchDiagnostic(slug), fetchTopicPlan(slug), fetchProblems(slug), fetchTopicLearn(slug),
  ]);
  return { diagnostic, plan, problems, lesson };
}

export default function TopicPage() {
  const { slug } = useParams<{ slug: string }>();
  const chapter = useSWR(["chapter", slug], () => loadChapter(slug), { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateOnMount: true, shouldRetryOnError: false });
  if (chapter.isValidating || !chapter.data || chapter.error) {
    return <div className="learn-main chapter-page"><LoadState error={chapter.error} retry={() => void chapter.mutate()} loading="Loading chapter…" /></div>;
  }
  return <Chapter key={slug} slug={slug} data={chapter.data} />;
}

function Chapter({ slug, data }: { slug: string; data: Awaited<ReturnType<typeof loadChapter>> }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(data.plan.overview_completed ? "practice" : data.plan.has_plan ? "plan" : "lesson");
  const { questions, prerequisites: prereqs } = data.diagnostic;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [planOut, setPlanOut] = useState<TopicPlan>(data.plan);
  const [overview, setOverview] = useState("");
  const [guiding, setGuiding] = useState<string | null>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>(data.problems);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = planOut.plan;
  const nextId = [plan?.next_problem_id, ...(plan?.recommended ?? []).map((item) => item.id)]
    .find((id) => id && problems.some((problem) => problem.id === id && !problem.mastered));

  const orderedProblems = useMemo(() => {
    if (!plan) return problems;
    const rank = (id: string) => {
      if ((plan.review_first || []).some((x) => x.id === id)) return 0;
      if ((plan.recommended || []).some((x) => x.id === id)) return 1;
      if ((plan.optional || []).some((x) => x.id === id)) return 2;
      return 3;
    };
    return [...problems].sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title));
  }, [problems, plan]);

  async function onSubmitDiagnostic() {
    setBusy(true);
    setError(null);
    try {
      const missing = questions.filter((q) => (answers[q.id] ?? -1) < 0);
      if (missing.length) {
        setError("Answer every question to build your plan.");
        return;
      }
      const payload: Record<string, number> = {};
      for (const q of questions) payload[q.id] = answers[q.id];
      // Also send choice text for scale/goal fields (plan agent reads strings)
      const enriched: Record<string, string | number> = { ...payload };
      for (const q of questions) {
        const idx = answers[q.id];
        if (idx >= 0 && q.choices[idx]) enriched[q.id] = q.type === "mcq" ? idx : q.choices[idx];
      }
      const res = await submitDiagnostic(slug, enriched);
      setPlanOut(res);
      // refresh problem badges
      setProblems(await fetchProblems(slug));
      setStep("plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnostic failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLoadOverview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchTopicOverview(slug);
      setOverview(res.overview_markdown);
      setGuiding(res.guiding_question);
      setStep("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Overview failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCompleteOverview(problemId?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await completeTopicOverview(slug);
      setPlanOut(res);
      if (problemId) router.push(`/problems/${problemId}`);
      else setStep("practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete overview");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="learn-main chapter-page">
      <Link href="/learn" className="learn-text-link">← Learning roadmap</Link>
      <PageHeading label={slug === "two-pointers" ? "Chapter · Sample path" : "Chapter"} title={data.lesson.title} copy="Read the core idea, try a dry run, or take an optional diagnostic for a tailored practice plan." />
      <Prerequisites items={prereqs} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Chapter sections">
        {STEPS.map((s) => {
          const unlocked =
            s.id === "lesson" || s.id === "diagnose" || s.id === "practice" ||
            (s.id === "plan" && planOut?.has_plan) ||
            (s.id === "overview" && planOut?.has_plan);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={step === s.id}
              disabled={!unlocked || busy}
              onClick={() => {
                setError(null);
                if (s.id === "overview") void onLoadOverview();
                else setStep(s.id);
              }}
              className={`rounded-md border border-[var(--line)] px-3 py-2 text-sm font-bold transition ${
                step === s.id
                  ? "bg-[var(--accent)] text-white"
                  : unlocked
                    ? "bg-black/5 text-[var(--muted)] hover:bg-black/10"
                    : "cursor-not-allowed bg-black/[0.03] text-[var(--muted)] opacity-50"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="rounded-md border border-[var(--bad)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--bad)]">{error}</p>}

      {step === "lesson" && (
        <section className="learn-panel flex flex-col gap-5 p-5 sm:p-7" aria-labelledby="chapter-core">
          <div><p className="learn-kicker">Core concept</p><h2 id="chapter-core" className="text-2xl font-semibold">Chapter notes</h2></div>
          <ChapterNotes text={data.lesson.notes_markdown} />
          <div className="border-t border-[var(--line)] pt-5">
            <div className="flex flex-wrap items-center gap-3">
              {data.lesson.demo_problem_id && <LearningLink href={`/problems/${data.lesson.demo_problem_id}`} primary>Try a guided dry run</LearningLink>}
              <button type="button" onClick={() => setStep("diagnose")} className="learn-text-link">Take the diagnostic</button>
              <button type="button" onClick={() => setStep("practice")} className="learn-text-link">See chapter problems</button>
            </div>
          </div>
        </section>
      )}

      {step === "diagnose" && (
        <section className="panel mt-6 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Diagnostic agent</p>
          <h2 className="mt-1 text-xl font-semibold">Prerequisite check</h2>
          {prereqs.length > 0 && (
            <p className="mt-2 text-sm text-[var(--muted)]">Helpful background: {prereqs.join(" · ")}</p>
          )}
          <div className="mt-5 space-y-5">
            {questions.map((q) => (
              <fieldset key={q.id}>
                <legend className="text-sm font-semibold">{q.prompt}</legend>
                <div className="mt-2 flex flex-col gap-2">
                  {q.choices.map((c, i) => (
                    <label key={i} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === i}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <Button className="mt-6" onClick={onSubmitDiagnostic} disabled={busy}>
            {busy ? "Building plan…" : "Build my soft plan"}
          </Button>
          <Button className="mt-6 ml-2" variant="secondary" onClick={() => setStep("practice")}>
            Skip to practice
          </Button>
        </section>
      )}

      {step === "plan" && plan && (
        <section className="panel mt-6 space-y-4 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Plan agent</p>
          <h2 className="text-xl font-semibold">Your soft learning plan</h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{plan.review_notes}</p>
          <p className="text-xs text-[var(--muted)]">Emphasis: {plan.emphasis || "balanced"} · guidance only — nothing is locked</p>
          <BeforeYouCode reviews={plan.micro_reviews || []} />
          <div className="space-y-2">
            {[...(plan.review_first || []), ...(plan.recommended || []), ...(plan.optional || [])].map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] px-3 py-2 text-sm">
                <div>
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${badgeClass(item.badge)}`}>
                    {badgeLabel(item.badge) || item.badge}
                  </span>
                  {item.title}
                </div>
                <span className="text-xs uppercase text-[var(--muted)]">{item.difficulty}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onLoadOverview} disabled={busy}>
              Continue to overview
            </Button>
            <Button variant="secondary" onClick={() => setStep("practice")}>
              Skip to practice
            </Button>
          </div>
        </section>
      )}

      {step === "overview" && (
        <section className="panel mt-6 space-y-4 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Teach agent</p>
          <h2 className="text-xl font-semibold">Brief topic overview</h2>
          <ChapterNotes text={overview || data.lesson.notes_markdown} />
          {guiding && (
            <p className="rounded-md border border-[var(--line)] bg-[#f7faf8] px-3 py-2 text-sm text-[var(--muted)]">
              Guiding question: {guiding}
            </p>
          )}
          <BeforeYouCode reviews={plan?.micro_reviews || []} />
          <p className="text-xs font-medium text-[var(--muted)]">
            Skim the cards above, then open the recommended problem and finish See → Predict → Code → Test → Viva.
          </p>
          <div className="flex flex-wrap gap-2">
            {nextId ? (
              <Button onClick={() => void onCompleteOverview(nextId)} disabled={busy}>
                Start recommended problem
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void onCompleteOverview()} disabled={busy}>
              Mark overview done → practice list
            </Button>
          </div>
        </section>
      )}

      {step === "practice" && (
        <section className="panel mt-6 rounded-xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Practice</p>
              <h2 className="text-xl font-semibold">Problems</h2>
              <p className="text-sm text-[var(--muted)]">Open any problem — badges are soft recommendations only.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(new Map(orderedProblems.map((p) => [p.pattern_id || p.pattern, p.pattern])).entries()).map(
                  ([id, title]) => (
                    <Link
                      key={String(id)}
                      href={`/practice?topic=${encodeURIComponent(slug)}&pattern=${encodeURIComponent(String(id))}`}
                      className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {title}
                    </Link>
                  ),
                )}
              </div>
              {nextId && (
                <p className="mt-1 text-xs font-medium text-[var(--accent)]">
                  Next: open the recommended problem and complete the full stage loop.
                </p>
              )}
            </div>
            {nextId && (
              <Link
                href={`/problems/${nextId}`}
                className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm"
              >
                Open recommended →
              </Link>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {orderedProblems.map((p) => {
              const b = p.plan_badge || (plan?.review_first || []).find((x) => x.id === p.id)?.badge;
              return (
                <li key={p.id}>
                  <Link href={`/problems/${p.id}`} className="flex flex-wrap items-center gap-3 py-3 text-sm hover:bg-[var(--study-page)]">
                    {b && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${badgeClass(b)}`}>
                        {badgeLabel(b)}
                      </span>
                    )}
                    <span className="flex-1 font-medium">{p.title}</span>
                    <span className="text-xs capitalize text-[var(--muted)]">{p.difficulty}</span>
                    <ProblemStatus problem={p} />
                  </Link>
                </li>
              );
            })}
          </ul>
          {!planOut?.has_plan && (
            <Button className="mt-4" variant="secondary" onClick={() => setStep("diagnose")}>
              Take diagnostic for a custom plan
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
