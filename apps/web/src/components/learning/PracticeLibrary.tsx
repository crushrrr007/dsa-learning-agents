"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import useSWR from "swr";
import { fetchPatterns, fetchProblems, fetchRoadmap, type ProblemSummary, type Topic } from "@/lib/api";
import { LoadState, PageHeading, ProblemStatus, problemState, problemStates } from "./shared";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const difficulties = ["easy", "medium", "hard"] as const;

async function loadLibrary() {
  const [problems, roadmap, patterns] = await Promise.all([fetchProblems(), fetchRoadmap(), fetchPatterns()]);
  return { problems, topics: [...roadmap.topics].sort((a, b) => a.order - b.order), patterns };
}

function ProblemTable({ problems, topics }: { problems: ProblemSummary[]; topics: Topic[] }) {
  const names = new Map(topics.map((topic) => [topic.slug, topic.title]));
  return (
    <div className="learn-panel practice-table-wrap">
      <table className="practice-table">
        <caption className="sr-only">Guided coding problems</caption>
        <thead><tr><th scope="col">Problem</th><th scope="col" className="practice-col-pattern">Pattern</th><th scope="col" className="practice-col-difficulty">Difficulty</th><th scope="col">Progress</th><th scope="col" className="practice-col-arrow"><span className="sr-only">Open</span></th></tr></thead>
        <tbody>
          {problems.map((problem) => {
            const name = names.get(problem.topic) ?? problem.topic.replaceAll("-", " ");
            return (
              <tr key={problem.id}>
                <td><Link href={`/problems/${problem.id}`} className="practice-title">{problem.title}</Link><span className="practice-topic">{name}</span><span className="practice-compact-meta">{problem.pattern} · {problem.difficulty}</span></td>
                <td className="practice-col-pattern"><Link href={`/practice?pattern=${encodeURIComponent(problem.pattern_id ?? problem.pattern)}`} className="practice-pattern">{problem.pattern}</Link></td>
                <td className="practice-col-difficulty"><span className="practice-difficulty">{problem.difficulty}</span></td>
                <td><ProblemStatus problem={problem} /></td>
                <td className="practice-col-arrow"><ArrowUpRight size={16} aria-hidden="true" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PracticeLibrary() {
  const params = useSearchParams();
  const library = useSWR("practice-library", loadLibrary, { revalidateOnMount: true });
  const query = (params.get("q") ?? "").slice(0, 120);
  const topic = params.get("topic") ?? "";
  const pattern = params.get("pattern") ?? "";
  const difficulty = params.get("difficulty") ?? "";
  const status = params.get("status") ?? "";
  const filtered = Boolean(query || topic || pattern || difficulty || status);

  function updateFilter(key: string, value: string, replace = false) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    const href = next.size ? `/practice?${next}` : "/practice";
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }

  const names = new Map(library.data?.topics.map((item) => [item.slug, item.title]));
  const terms = normalize(query).split(" ").filter(Boolean);
  const results = library.data?.problems.filter((problem) => {
    const text = normalize(`${problem.title} ${problem.pattern} ${problem.topic} ${names.get(problem.topic) ?? ""}`);
    return (!topic || problem.topic === topic)
      && (!pattern || problem.pattern_id === pattern || normalize(problem.pattern) === normalize(pattern))
      && (!difficulty || problem.difficulty.toLowerCase() === difficulty)
      && (!status || problemState(problem) === status)
      && terms.every((term) => text.includes(term));
  });

  return (
    <div className="learn-main">
      <PageHeading label="Guided coding" title="Practice library" copy="Search the problem set or narrow it by technique. Every problem opens the same guided Python workspace." />
      <section className="learn-panel practice-controls" aria-label="Filter problems">
        <div className="practice-search"><Search size={20} aria-hidden="true" /><label className="sr-only" htmlFor="problem-search">Search problems</label><input id="problem-search" type="search" value={query} maxLength={120} placeholder="Search problems or patterns…" onChange={(event) => updateFilter("q", event.target.value, true)} /></div>
        <div className="practice-filters">
          <label>Topic<select value={topic} onChange={(event) => updateFilter("topic", event.target.value)}><option value="">All topics</option>{topic && !library.data?.topics.some((item) => item.slug === topic) && <option value={topic}>{topic}</option>}{library.data?.topics.map((item) => <option value={item.slug} key={item.slug}>{item.title}</option>)}</select></label>
          <label>Pattern<select value={pattern} onChange={(event) => updateFilter("pattern", event.target.value)}><option value="">All patterns</option>{pattern && !library.data?.patterns.some((item) => item.id === pattern) && <option value={pattern}>{pattern}</option>}{library.data?.patterns.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <label>Difficulty<select value={difficulty} onChange={(event) => updateFilter("difficulty", event.target.value)}><option value="">Any difficulty</option>{difficulties.map((item) => <option value={item} key={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
          <label>Progress<select value={status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Any progress</option>{Object.entries(problemStates).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
      </section>
      {results && library.data ? (
        <section className="practice-results" aria-label="Problem results">
          <div className="practice-results-head"><p role="status"><strong>{results.length}</strong> of {library.data.problems.length} {library.data.problems.length === 1 ? "problem" : "problems"}</p>{filtered && <button type="button" className="learn-text-link" onClick={() => window.history.pushState(null, "", "/practice")}><X size={16} aria-hidden="true" />Clear filters</button>}</div>
          {results.length > 0 ? <ProblemTable problems={results} topics={library.data.topics} /> : <div className="learn-panel learn-load"><h2 className="font-serif">No matching problems</h2><p>Try a broader search or clear some filters.</p></div>}
        </section>
      ) : <LoadState error={library.error} retry={() => void library.mutate()} loading="Loading the problem set…" />}
    </div>
  );
}
