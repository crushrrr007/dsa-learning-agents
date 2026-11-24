import Link from "next/link";
import { ArrowRight, Circle, CircleCheck, CircleDot, CornerDownRight } from "lucide-react";
import type { ProblemSummary } from "@/lib/api";

export function PageHeading({ label, title, copy }: { label: string; title: string; copy: string }) {
  return (
    <header className="learn-heading">
      <p className="learn-kicker">{label}</p>
      <h1 className="text-balance font-serif">{title}</h1>
      <p className="learn-intro">{copy}</p>
    </header>
  );
}

export function LoadState({ error, retry, loading }: { error?: Error; retry: () => void; loading: string }) {
  return (
    <div className="learn-panel learn-load">
      {error ? (
        <>
          <p role="alert">{error.message}</p>
          <button type="button" className="learn-button learn-button--outline" onClick={retry}>Try again</button>
        </>
      ) : <p role="status">{loading}</p>}
    </div>
  );
}

export const problemStates = {
  new: "Not started",
  started: "In progress",
  solved: "Solved",
  mastered: "Mastered",
} as const;

export function problemState(problem: ProblemSummary): keyof typeof problemStates {
  if (problem.mastered) return "mastered";
  if (problem.solved || problem.stage >= 4) return "solved";
  return problem.stage >= 2 ? "started" : "new";
}

export function ProblemStatus({ problem }: { problem: ProblemSummary }) {
  const state = problemState(problem);
  const Icon = state === "mastered" || state === "solved" ? CircleCheck : state === "started" ? CircleDot : Circle;
  return <span className={`learn-status learn-status--${state}`}><Icon size={15} aria-hidden="true" />{problemStates[state]}</span>;
}

export function LearningLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <Link href={href} className={primary ? "learn-button" : "learn-text-link"}>{children}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

export function Prerequisites({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return <p className="learn-prereqs"><CornerDownRight size={15} aria-hidden="true" /> <span>Helpful first: {items.join(" · ")}</span></p>;
}
