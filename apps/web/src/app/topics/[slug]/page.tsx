"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  completeTopicOverview,
  fetchDiagnostic,
  fetchProblems,
  fetchTopicOverview,
  fetchTopicPlan,
  submitDiagnostic,
  type MicroReview,
  type ProblemSummary,
  type TopicPlan,
} from "@/lib/api";

type Step = "diagnose" | "plan" | "overview" | "practice";

const STEPS: { id: Step; label: string }[] = [
  { id: "diagnose", label: "1 · Diagnose" },
  { id: "plan", label: "2 · Your plan" },
  { id: "overview", label: "3 · Overview" },
  { id: "practice", label: "4 · Practice" },
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

export default function TopicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [step, setStep] = useState<Step>("diagnose");
  const [title, setTitle] = useState(slug);
  const [prereqs, setPrereqs] = useState<string[]>([]);
  const [questions, setQuestions] = useState<{ id: string; type: string; prompt: string; choices: string[] }[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [planOut, setPlanOut] = useState<TopicPlan | null>(null);
  const [overview, setOverview] = useState<string>("");
  const [guiding, setGuiding] = useState<string | null>(null);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDiagnostic(slug), fetchTopicPlan(slug), fetchProblems(slug)])
      .then(([diag, plan, probs]) => {
        setTitle(diag.title.replace(/ — .*$/, "") || slug);
        setPrereqs(diag.prerequisites || []);
        setQuestions(diag.questions || []);
        setAnswers(Object.fromEntries((diag.questions || []).map((q) => [q.id, -1])));
        setProblems(probs);
        setPlanOut(plan);
        if (plan.has_plan && plan.overview_completed) setStep("practice");
        else if (plan.has_plan) setStep("plan");
        else setStep("diagnose");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const plan = planOut?.plan;
  const nextId = plan?.next_problem_id;

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

  async function onCompleteOverview() {
    setBusy(true);
    try {
      const res = await completeTopicOverview(slug);
      setPlanOut(res);
      setStep("practice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete overview");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-[var(--muted)]">Loading topic pipeline…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)] hover:underline">
        ← Problems
      </Link>
      <h1 className="display mt-3 text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Per-topic path: diagnose prerequisites → soft plan → brief teach → LeetCode-style practice. Problems stay
        openable anytime.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.id === "diagnose") setStep("diagnose");
              if (s.id === "plan" && planOut?.has_plan) setStep("plan");
              if (s.id === "overview" && planOut?.has_plan) void onLoadOverview();
              if (s.id === "practice") setStep("practice");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              step === s.id ? "bg-[var(--accent)] text-white" : "bg-black/5 text-[var(--muted)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {step === "diagnose" && (
        <section className="panel mt-6 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Diagnostic agent</p>
          <h2 className="mt-1 text-xl font-semibold">Prerequisite check</h2>
          {prereqs.length > 0 && (
            <p className="mt-2 text-sm text-[var(--muted)]">Helpful background: {prereqs.join(" · ")}</p>
          )}
          <div className="mt-5 space-y-5">
            {questions.map((q) => (
              <div key={q.id}>
                <p className="text-sm font-semibold">{q.prompt}</p>
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
              </div>
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
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
            {overview || "Loading…"}
          </div>
          {guiding && (
            <p className="rounded-md border border-[var(--line)] bg-[#f7faf8] px-3 py-2 text-sm text-[var(--muted)]">
              Guiding question: {guiding}
            </p>
          )}
          <BeforeYouCode reviews={plan?.micro_reviews || []} />
          <p className="text-xs font-medium text-[var(--muted)]">
            Evaluator: continue to the recommended problem after a quick skim of the cards above.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onCompleteOverview} disabled={busy}>
              Mark overview done → practice
            </Button>
            {nextId && (
              <Link
                href={`/problems/${nextId}`}
                className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Start recommended problem
              </Link>
            )}
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
                      href={`/?pattern=${encodeURIComponent(String(id))}`}
                      className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      {title}
                    </Link>
                  ),
                )}
              </div>
              {nextId && (
                <p className="mt-1 text-xs font-medium text-[var(--accent)]">
                  Evaluator: continue to recommended problem →
                </p>
              )}
            </div>
            {nextId && (
              <Link
                href={`/problems/${nextId}`}
                className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Recommended →
              </Link>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {orderedProblems.map((p) => {
              const b = p.plan_badge || (plan?.review_first || []).find((x) => x.id === p.id)?.badge;
              return (
                <li key={p.id}>
                  <Link href={`/problems/${p.id}`} className="flex items-center gap-3 py-3 text-sm hover:bg-black/[0.02]">
                    {b && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${badgeClass(b)}`}>
                        {badgeLabel(b)}
                      </span>
                    )}
                    <span className="flex-1 font-medium">{p.title}</span>
                    <span className="text-xs uppercase text-[var(--muted)]">{p.difficulty}</span>
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
