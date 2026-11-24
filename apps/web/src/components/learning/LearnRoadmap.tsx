"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, GitBranch } from "lucide-react";
import useSWR from "swr";
import { fetchPatterns, fetchRoadmap, type Topic } from "@/lib/api";
import { LoadState, PageHeading, Prerequisites } from "./shared";

function ChapterList({ topics }: { topics: Topic[] }) {
  const ordered = [...topics].sort((a, b) => (a.phase ?? 1) - (b.phase ?? 1) || a.order - b.order);
  const groups = [
    { title: "Core structures & patterns", items: ordered.filter((topic) => (topic.phase ?? 1) === 1) },
    { title: "Advanced structures & search", items: ordered.filter((topic) => (topic.phase ?? 1) > 1) },
  ];
  return groups.filter((group) => group.items.length > 0).map((group, chapterGroup) => (
    <section key={group.title} className="learn-chapters" aria-labelledby={`chapter-group-${chapterGroup}`}>
      <div className="learn-section-heading"><div><p className="learn-kicker">{chapterGroup === 0 ? "Foundations" : "Build on the basics"}</p><h2 id={`chapter-group-${chapterGroup}`} className="font-serif">{group.title}</h2></div><span className="learn-pill">{group.items.length} chapters</span></div>
      <ol className="learn-panel learn-chapter-list" start={ordered.indexOf(group.items[0]) + 1}>
        {group.items.map((topic) => {
          const complete = topic.problems_total > 0 && topic.problems_mastered === topic.problems_total;
          return (
            <li key={topic.slug}>
              <Link href={`/topics/${topic.slug}`} className="learn-chapter-row">
                <span className="learn-chapter-number">{complete ? <Check size={19} aria-label="Complete" /> : String(ordered.indexOf(topic) + 1).padStart(2, "0")}</span>
                <div className="learn-chapter-copy"><h3 className="font-serif">{topic.title}</h3><p>{topic.summary}</p><Prerequisites items={topic.prerequisites} /></div>
                <div className="learn-chapter-count"><span>{topic.problems_mastered}/{topic.problems_total}</span><span>mastered</span></div>
                <ArrowRight size={19} className="learn-row-arrow" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  ));
}

export function LearnRoadmap() {
  const params = useSearchParams();
  const patternsPath = params.get("path") === "patterns";
  const roadmap = useSWR("learning-roadmap", fetchRoadmap, { revalidateOnMount: true });
  const patterns = useSWR(patternsPath ? "learning-patterns" : null, fetchPatterns);
  const names = new Map(roadmap.data?.topics.map((topic) => [topic.slug, topic.title]));
  return (
    <div className="learn-main">
      <PageHeading label="The curriculum" title="Learning roadmap" copy="Follow the foundations in order, or go straight to the interview patterns you want to strengthen." />
      <div className="learn-toolbar">
        <nav aria-label="Learning path" className="learn-segment">
          <Link href="/learn?path=foundations" aria-current={!patternsPath ? "page" : undefined}><BookOpen size={17} aria-hidden="true" />Foundations</Link>
          <Link href="/learn?path=patterns" aria-current={patternsPath ? "page" : undefined}><GitBranch size={17} aria-hidden="true" />Interview Patterns</Link>
        </nav>
      </div>
      {patternsPath ? (
        patterns.data ? <section className="learn-chapters" aria-labelledby="pattern-library"><div className="learn-section-heading"><div><p className="learn-kicker">Practice by technique</p><h2 id="pattern-library" className="font-serif">Pattern library</h2></div><span className="learn-pill">{patterns.data.length} patterns</span></div><ul className="learn-patterns">{patterns.data.map((pattern) => <li key={pattern.id}><Link href={`/practice?pattern=${encodeURIComponent(pattern.id)}`} className="learn-panel learn-pattern-card"><span className="learn-icon"><GitBranch size={19} aria-hidden="true" /></span><div><h3 className="font-serif">{pattern.title}</h3><p>{pattern.topics.map((topic) => names.get(topic) ?? topic.replaceAll("-", " ")).join(" · ")}</p><span>{pattern.problems_total} {pattern.problems_total === 1 ? "problem" : "problems"}</span></div><ArrowRight size={17} className="learn-row-arrow" aria-hidden="true" /></Link></li>)}</ul></section> : <LoadState error={patterns.error} retry={() => void patterns.mutate()} loading="Loading patterns…" />
      ) : roadmap.data ? <ChapterList topics={roadmap.data.topics} /> : <LoadState error={roadmap.error} retry={() => void roadmap.mutate()} loading="Loading chapters…" />}
    </div>
  );
}
