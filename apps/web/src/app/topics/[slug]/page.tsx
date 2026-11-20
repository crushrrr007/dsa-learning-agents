"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchProblems,
  fetchTopicLearn,
  runTopicDemo,
  submitQuiz,
  type ProblemSummary,
  type TraceEvent,
} from "@/lib/api";

const VisualCanvas = dynamic(
  () => import("@/components/workspace/VisualCanvas").then((m) => m.VisualCanvas),
  { ssr: false },
);

export default function TopicPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [quiz, setQuiz] = useState<{ question: string; choices: string[] }[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [learnDone, setLearnDone] = useState(false);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [quizMsg, setQuizMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoTitle, setDemoTitle] = useState<string | null>(null);
  const [demoVisual, setDemoVisual] = useState("array");
  const [demoEvents, setDemoEvents] = useState<TraceEvent[]>([]);
  const [demoIdx, setDemoIdx] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoMeta, setDemoMeta] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    Promise.all([fetchTopicLearn(slug), fetchProblems(slug)])
      .then(([learn, probs]) => {
        setTitle(learn.title);
        setNotes(learn.notes_markdown);
        setQuiz(learn.quiz);
        setAnswers(learn.quiz.map(() => -1));
        setLearnDone(learn.learn_completed);
        setProblems(probs);
        setDemoTitle(learn.demo_title);
        setDemoVisual(learn.demo_visual || "array");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!demoPlaying || demoEvents.length === 0) return;
    const t = setInterval(() => {
      setDemoIdx((i) => {
        if (i >= demoEvents.length - 1) {
          setDemoPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 400);
    return () => clearInterval(t);
  }, [demoPlaying, demoEvents.length]);

  const htmlNotes = useMemo(() => {
    return notes
      .split("\n")
      .map((line) => {
        if (line.startsWith("# ")) return `<h1 class="display text-3xl font-semibold mb-3">${line.slice(2)}</h1>`;
        if (line.startsWith("## ")) return `<h2 class="display text-xl font-semibold mt-5 mb-2">${line.slice(3)}</h2>`;
        if (line.startsWith("- ")) return `<li class="ml-5 list-disc text-[var(--muted)]">${line.slice(2)}</li>`;
        if (!line.trim()) return "<div class='h-2'></div>";
        return `<p class="text-[var(--muted)] leading-relaxed">${line}</p>`;
      })
      .join("\n");
  }, [notes]);

  async function onSubmitQuiz() {
    setQuizMsg(null);
    try {
      const res = await submitQuiz(slug, answers);
      setQuizMsg(
        res.passed
          ? `Passed (${Math.round(res.score * 100)}%). Problems unlocked.`
          : `Score ${Math.round(res.score * 100)}%. Need about 2/3 correct — review the notes and retry.`,
      );
      setLearnDone(res.learn_completed);
      if (res.learn_completed) {
        const probs = await fetchProblems(slug);
        setProblems(probs);
      }
    } catch (e) {
      setQuizMsg(e instanceof Error ? e.message : "Quiz failed");
    }
  }

  async function onRunDemo() {
    setDemoBusy(true);
    setDemoMeta(null);
    try {
      const res = await runTopicDemo(slug);
      setDemoEvents(res.events || []);
      setDemoIdx(0);
      setDemoPlaying(true);
      setDemoVisual(res.visual || demoVisual);
      setDemoTitle(res.title);
      setDemoMeta(
        res.ok
          ? `${res.explanation} Result: ${JSON.stringify(res.result)} · ${res.duration_ms} ms`
          : res.error || "Demo failed",
      );
    } catch (e) {
      setDemoMeta(e instanceof Error ? e.message : "Demo failed");
    } finally {
      setDemoBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-[var(--muted)]">Loading topic…</div>;
  }
  if (error) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-red-700">{error}</div>;
  }

  const current = demoEvents[demoIdx] || null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/" className="text-sm font-medium text-[var(--accent)] hover:underline">
        ← Roadmap
      </Link>
      <h1 className="display mt-3 text-4xl font-semibold">{title}</h1>
      <p className="mt-2 text-[var(--muted)]">
        Stage 0 — learn the concept once (notes + traced demo + check), then enter the 4-step practice loop.
      </p>

      <article
        className="panel mt-8 rounded-xl p-6 sm:p-8 animate-rise"
        dangerouslySetInnerHTML={{ __html: htmlNotes }}
      />

      <section className="panel mt-8 rounded-xl p-6 sm:p-8 animate-rise-delay">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display text-2xl font-semibold">Traced concept demo</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {demoTitle ? `Live run of “${demoTitle}”` : "Run a short traced demo for this topic."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onRunDemo} disabled={demoBusy}>
              {demoBusy ? "Running…" : "Run traced demo"}
            </Button>
            <Button
              variant="secondary"
              disabled={!demoEvents.length}
              onClick={() => setDemoPlaying((p) => !p)}
            >
              {demoPlaying ? "Pause" : "Play"}
            </Button>
          </div>
        </div>
        <div className="mt-4 h-[260px] overflow-hidden rounded-xl border border-[var(--line)]">
          <VisualCanvas visual={demoVisual} event={current} />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {demoMeta ||
            (demoEvents.length
              ? `Frame ${demoIdx + 1}/${demoEvents.length}`
              : "Press run to stream real sys.settrace frames.")}
        </p>
      </section>

      {!learnDone ? (
        <section className="panel mt-8 rounded-xl p-6 sm:p-8">
          <h2 className="display text-2xl font-semibold">Concept check</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Answer 3 questions to unlock problems.</p>
          <div className="mt-6 space-y-6">
            {quiz.map((q, qi) => (
              <div key={qi}>
                <p className="font-semibold">
                  {qi + 1}. {q.question}
                </p>
                <div className="mt-3 grid gap-2">
                  {q.choices.map((c, ci) => (
                    <label
                      key={ci}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                        answers[qi] === ci
                          ? "border-[var(--accent)] bg-[var(--accent)]/5"
                          : "border-[var(--line)] bg-white/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${qi}`}
                        checked={answers[qi] === ci}
                        onChange={() =>
                          setAnswers((prev) => prev.map((v, i) => (i === qi ? ci : v)))
                        }
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={onSubmitQuiz}>Submit check</Button>
            {quizMsg && <p className="text-sm text-[var(--muted)]">{quizMsg}</p>}
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-2xl font-semibold">Problems</h2>
            <span className="text-sm text-[var(--good)]">Concept unlocked</span>
          </div>
          <div className="grid gap-3">
            {problems.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/problems/${p.id}`)}
                className="panel flex items-center justify-between rounded-xl px-5 py-4 text-left transition hover:border-[var(--accent)]/40"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{p.title}</h3>
                    <span className="rounded bg-black/5 px-2 py-0.5 text-xs uppercase tracking-wide text-[var(--muted)]">
                      {p.difficulty}
                    </span>
                    <span className="text-xs text-[var(--accent)]">{p.pattern}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {p.mastered ? "Mastered" : p.stage > 0 ? `Stage ${p.stage}` : "Ready"}
                  </p>
                </div>
                <span className="text-[var(--accent)]">Open →</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
