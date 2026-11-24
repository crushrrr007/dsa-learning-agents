"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ChartNoAxesColumn, Code2, Compass, GitBranch, MoveRight, Play } from "lucide-react";
import useSWR from "swr";
import { fetchLearnerDashboard, type LearnerDashboard } from "@/lib/api";
import { LearningLink, LoadState, PageHeading } from "./shared";

const nextSteps = ["", "See", "Predict", "Code & test", "Viva"];

function NextAction({ action }: { action: LearnerDashboard["action"] }) {
  const href = action.problem_id ? `/problems/${action.problem_id}` : action.topic ? `/topics/${action.topic}` : "/practice";
  const copy = action.kind === "resume" ? "Resume practice" : action.kind === "lesson" ? "Start chapter" : action.kind === "recommended" ? "Open problem" : "Browse problems";
  const tag = action.kind === "resume" ? "In progress" : action.kind === "lesson" ? "Foundations" : action.kind === "recommended" ? "Guided practice" : "Complete";
  return (
    <section aria-labelledby="today-next" className="learn-panel today-next">
      <div className="today-next-top"><span className="learn-kicker"><Compass size={16} aria-hidden="true" /> Up next</span><span className="learn-pill">{tag}</span></div>
      <div>
        <h2 id="today-next" className="text-balance font-serif">{action.title}</h2>
        <p className="learn-intro">{action.reason}</p>
      </div>
      <div className="today-next-actions">
        <LearningLink href={href} primary>{copy}</LearningLink>
        {action.kind === "resume" && action.stage ? <span>Next stage: <strong>{nextSteps[action.stage]}</strong></span> : null}
      </div>
    </section>
  );
}

function TracePreview() {
  return (
    <figure className="today-trace">
      <figcaption><Code2 size={17} aria-hidden="true" /> Inside a guided practice</figcaption>
      <div className="today-trace-body">
        <p className="today-trace-title text-balance font-serif">See the pattern.<br /> Predict the move.</p>
        <div aria-hidden="true" className="today-trace-cells font-mono">
          {[-4, -1, 0, 3, 10].map((value, i) => (
            <div key={value} className={i === 0 || i === 4 ? "trace-end" : undefined}>
              <span>{i === 0 ? "L ↓" : i === 4 ? "R ↓" : " "}</span><strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className="today-trace-note"><MoveRight size={16} aria-hidden="true" /> Run real Python traces with a coach at each stage.</p>
      </div>
    </figure>
  );
}

export function Today() {
  const { data, error, mutate } = useSWR<LearnerDashboard, Error>("learner-dashboard", fetchLearnerDashboard, { revalidateOnMount: true });
  return (
    <div className="learn-main today-main">
      <PageHeading label="Your study desk" title="Your next move." copy="Learn the pattern, work through it with a coach, then explain why your code works." />
      <div className="today-feature">
        {data ? <NextAction action={data.action} /> : <LoadState error={error} retry={() => void mutate()} loading="Finding your next step…" />}
        <TracePreview />
      </div>
      <section className="today-paths" aria-labelledby="today-paths">
        <div className="learn-section-heading"><div><p className="learn-kicker">The curriculum</p><h2 id="today-paths" className="font-serif">Choose how to learn</h2></div><LearningLink href="/practice">Browse problem library</LearningLink></div>
        <div className="today-path-grid">
          <Link href="/learn?path=foundations" className="learn-panel today-path">
            <span className="learn-icon"><BookOpen size={21} aria-hidden="true" /></span>
            <div><h3 className="font-serif">Foundations</h3><p>Follow a chapter-by-chapter path from arrays to graphs and dynamic programming.</p></div>
            <ArrowRight size={19} aria-hidden="true" className="today-path-arrow" />
          </Link>
          <Link href="/learn?path=patterns" className="learn-panel today-path">
            <span className="learn-icon"><GitBranch size={21} aria-hidden="true" /></span>
            <div><h3 className="font-serif">Interview Patterns</h3><p>Pick a technique to strengthen and find problems that use it.</p></div>
            <ArrowRight size={19} aria-hidden="true" className="today-path-arrow" />
          </Link>
        </div>
      </section>
      <section className="learn-panel today-progress" aria-labelledby="today-progress">
        <div className="today-progress-title"><span className="learn-icon"><ChartNoAxesColumn size={20} aria-hidden="true" /></span><div><h2 id="today-progress" className="font-serif">Guest progress</h2><p>Saved in this browser session.</p></div></div>
        {data && <dl className="today-counts"><div><dt>Solved</dt><dd>{data.problems_solved}<span>/{data.problems_total}</span></dd></div><div><dt>Mastered</dt><dd>{data.problems_mastered}<span>/{data.problems_total}</span></dd></div></dl>}
        <LearningLink href="/progress">View progress</LearningLink>
      </section>
      <Link href="/topics/two-pointers" className="learn-sample"><Play size={16} aria-hidden="true" /> Try the Two Pointers sample</Link>
    </div>
  );
}
