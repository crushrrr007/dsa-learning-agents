"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
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

const STEPS: {
  id: Step;
  label: string;
  agent: string;
  blurb: string;
}[] = [
  {
    id: "diagnose",
    label: "Diagnose",
    agent: "Diagnostic agent",
    blurb: "Find gaps before you grind — free, personalized.",
  },
  {
    id: "plan",
    label: "Plan",
    agent: "Plan agent",
    blurb: "Soft ordered path (review → recommended → optional).",
  },
  {
    id: "overview",
    label: "Teach",
    agent: "Teach agent",
    blurb: "Short pattern overview — then open a problem with coaches.",
  },
  {
    id: "practice",
    label: "Practice",
    agent: "Workspace coaches",
    blurb: "See → Predict → Code → Test → Viva with five specialists.",
  },
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
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4">
      <h3 className="text-sm font-bold text-amber-950">Before you code</h3>
      <p className="mt-1 text-xs text-amber-900/80">
        Micro-reviews from your diagnostic — skim these (the kind of guidance paid platforms sell).
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
                Review {r.prereq_topic.replace(/-/g, " ")} topic →
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
  const stepIndex = STEPS.findIndex((s) => s.id === step);

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
      const enriched: Record<string, string | number> = { ...payload };
      for (const q of questions) {
        const idx = answers[q.id];
        if (idx >= 0 && q.choices[idx]) enriched[q.id] = q.type === "mcq" ? idx : q.choices[idx];
      }
      const res = await submitDiagnostic(slug, enriched);
      setPlanOut(res);
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

  if (loading) return <div className="p-8 text-[var(--muted)]">Loading learning path…</div>;

  const isPilot = slug === "two-pointers";
  const mastered = problems.filter((p) => p.mastered).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/" className="text-sm font-semibold text-[var(--accent)] hover:underline">
        ← Practice sheet
      </Link>

      <div className="mt-4">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
          <Sparkles className="h-3.5 w-3.5" />
          Agentic learning path
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="display text-4xl font-extrabold tracking-tight">{title}</h1>
          {isPilot && (
            <span className="rounded-lg bg-teal-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-700">
              Demo path
            </span>
          )}
        </div>
        <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
          Other platforms charge for guided paths and animations. Here, agents diagnose gaps, plan practice, teach the
          pattern, then coach you through See → Predict → Code → Test → Viva — without dumping solutions.
        </p>
        <p className="mt-2 text-xs font-semibold tabular-nums text-[var(--muted)]">
          {mastered}/{problems.length} mastered on this topic
        </p>
      </div>

      {/* Vertical progress of agents */}
      <ol className="mt-8 space-y-0">
        {STEPS.map((s, i) => {
          const unlocked =
            s.id === "diagnose" ||
            s.id === "practice" ||
            (s.id === "plan" && planOut?.has_plan) ||
            (s.id === "overview" && planOut?.has_plan);
          const done =
            (s.id === "diagnose" && Boolean(planOut?.has_plan)) ||
            (s.id === "plan" && Boolean(planOut?.has_plan) && (stepIndex > 1 || planOut?.overview_completed)) ||
            (s.id === "overview" && Boolean(planOut?.overview_completed)) ||
            (s.id === "practice" && mastered > 0);
          const active = step === s.id;
          return (
            <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < STEPS.length - 1 && (
                <span
                  className={`absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-0.5 ${
                    done || active ? "bg-teal-500/50" : "bg-slate-200"
                  }`}
                />
              )}
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (s.id === "diagnose") setStep("diagnose");
                  if (s.id === "plan" && planOut?.has_plan) setStep("plan");
                  if (s.id === "overview" && planOut?.has_plan) void onLoadOverview();
                  if (s.id === "practice") setStep("practice");
                }}
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition ${
                  active
                    ? "bg-[var(--accent)] text-white shadow-md"
                    : done
                      ? "bg-teal-600 text-white"
                      : unlocked
                        ? "border-2 border-teal-500/40 bg-white text-teal-800"
                        : "border border-slate-200 bg-slate-50 text-slate-400"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done && !active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </button>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (s.id === "diagnose") setStep("diagnose");
                  if (s.id === "plan" && planOut?.has_plan) setStep("plan");
                  if (s.id === "overview" && planOut?.has_plan) void onLoadOverview();
                  if (s.id === "practice") setStep("practice");
                }}
                className={`min-w-0 flex-1 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-teal-500/40 bg-white shadow-[var(--shadow)]"
                    : unlocked
                      ? "border-[var(--line)] bg-white/70 hover:border-teal-400/40"
                      : "cursor-not-allowed border-transparent bg-slate-50/80 opacity-60"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{s.agent}</p>
                <p className="font-bold text-[var(--ink)]">{s.label}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{s.blurb}</p>
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      {step === "diagnose" && (
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Diagnostic agent</p>
          <h2 className="display mt-1 text-2xl font-bold">Prerequisite check</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Answer honestly — the Plan agent uses this to order problems. No account, no paywall.
          </p>
          {prereqs.length > 0 && (
            <p className="mt-2 text-sm text-[var(--muted)]">Helpful background: {prereqs.join(" · ")}</p>
          )}
          <div className="mt-5 space-y-5">
            {questions.map((q) => (
              <div key={q.id}>
                <p className="text-sm font-semibold">{q.prompt}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {q.choices.map((c, i) => (
                    <label
                      key={i}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        answers[q.id] === i
                          ? "border-teal-500/50 bg-teal-50"
                          : "border-[var(--line)] hover:border-teal-400/30"
                      }`}
                    >
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
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={onSubmitDiagnostic} disabled={busy}>
              {busy ? "Building plan…" : "Build my soft plan"}
            </Button>
            <Button variant="secondary" onClick={() => setStep("practice")}>
              Skip to practice
            </Button>
          </div>
        </section>
      )}

      {step === "plan" && plan && (
        <section className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Plan agent</p>
          <h2 className="display text-2xl font-bold">Your soft learning plan</h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{plan.review_notes}</p>
          <p className="text-xs text-[var(--muted)]">
            Emphasis: {plan.emphasis || "balanced"} · guidance only — nothing is locked
          </p>
          <BeforeYouCode reviews={plan.micro_reviews || []} />
          <div className="space-y-2">
            {[...(plan.review_first || []), ...(plan.recommended || []), ...(plan.optional || [])].map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm"
              >
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
              Continue to Teach agent
            </Button>
            {nextId && (
              <Link
                href={`/problems/${nextId}`}
                className="inline-flex h-11 items-center gap-1 rounded-xl border border-[var(--line)] px-4 text-sm font-bold text-[var(--accent)]"
              >
                Jump to recommended <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Button variant="secondary" onClick={() => setStep("practice")}>
              Skip to practice
            </Button>
          </div>
        </section>
      )}

      {step === "overview" && (
        <section className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Teach agent</p>
          <h2 className="display text-2xl font-bold">Brief topic overview</h2>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
            {overview || "Loading…"}
          </div>
          {guiding && (
            <p className="rounded-lg border border-[var(--line)] bg-[#f7faf8] px-3 py-2 text-sm text-[var(--muted)]">
              Guiding question: {guiding}
            </p>
          )}
          <BeforeYouCode reviews={plan?.micro_reviews || []} />
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-sm text-teal-950">
            <p className="font-bold">Next: multi-agent workspace</p>
            <p className="mt-1 text-teal-900/80">
              Open the recommended problem. Demo Coach animates the structure (AlgoMaster-style), Predict Coach locks
              understanding, Code Mentor debugs from tests, Viva Agent unlocks mastery — free.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextId ? (
              <Link
                href={`/problems/${nextId}`}
                onClick={() => void completeTopicOverview(slug)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-bold text-white shadow-sm"
              >
                Start recommended problem <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            <Button variant="secondary" onClick={onCompleteOverview} disabled={busy}>
              Mark overview done → practice list
            </Button>
          </div>
        </section>
      )}

      {step === "practice" && (
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Workspace coaches</p>
              <h2 className="display text-2xl font-bold">Practice with agents</h2>
              <p className="text-sm text-[var(--muted)]">
                Each problem opens Learn · Visual · Problem. Finish the full loop to master.
              </p>
              {nextId && (
                <p className="mt-1 text-xs font-medium text-[var(--accent)]">
                  Recommended next is highlighted — agents adapt to your stage.
                </p>
              )}
            </div>
            {nextId && (
              <Link
                href={`/problems/${nextId}`}
                className="inline-flex h-11 items-center gap-1 rounded-xl bg-[var(--accent)] px-5 text-sm font-bold text-white shadow-sm"
              >
                Open recommended <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {orderedProblems.map((p) => {
              const b = p.plan_badge || (plan?.review_first || []).find((x) => x.id === p.id)?.badge;
              const isNext = p.id === nextId;
              return (
                <li key={p.id}>
                  <Link
                    href={`/problems/${p.id}`}
                    className={`flex items-center gap-3 py-3 text-sm transition hover:bg-black/[0.02] ${
                      isNext ? "rounded-lg bg-teal-50/80 px-2" : ""
                    }`}
                  >
                    {p.mastered ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300" />
                    )}
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
