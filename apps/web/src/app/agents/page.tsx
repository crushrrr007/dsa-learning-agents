import type { Metadata } from "next";
import { ClipboardCheck, Map, NotebookPen } from "lucide-react";
import { CoachingWalkthrough } from "@/components/learning/CoachingWalkthrough";
import { LearningLink, PageHeading } from "@/components/learning/shared";

export const metadata: Metadata = {
  title: "How the Agents Work | Pointer Lab",
  description: "See how Pointer Lab routes DSA questions to specialist coaches and turns a practice session into evidence of understanding.",
};

const preparation = [
  { title: "Diagnostic Agent", icon: ClipboardCheck, copy: "Scores the optional prerequisite check and flags skills that need a refresher." },
  { title: "Plan Agent", icon: Map, copy: "Uses the diagnostic and available past progress to suggest what to review and which problem to try next." },
  { title: "Teach Agent", icon: NotebookPen, copy: "Turns curriculum notes into a short overview and a guiding question for the chapter." },
];

export default function AgentsPage() {
  return (
    <div className="learn-main coach-page">
      <PageHeading label="The teaching team" title="One problem. Different kinds of help." copy="Pointer Lab gives you a different kind of help when you’re learning a pattern, reading a trace, debugging code, or explaining your reasoning." />
      <CoachingWalkthrough />
      <section className="learn-chapters" aria-labelledby="coach-prep">
        <div className="learn-section-heading"><div><p className="learn-kicker">Before practice</p><h2 id="coach-prep" className="font-serif">How a chapter gets personal</h2></div></div>
        <ol className="coach-prep-list">
          {preparation.map(({ title, copy, icon: Icon }) => <li className="learn-panel coach-prep-item" key={title}><span className="learn-icon"><Icon size={20} aria-hidden="true" /></span><h3 className="font-serif">{title}</h3><p>{copy}</p></li>)}
        </ol>
      </section>
      <section className="learn-panel coach-outcome" aria-labelledby="coach-outcome">
        <div><p className="learn-kicker">What success looks like</p><h2 id="coach-outcome" className="font-serif">From a hint to an independent solve</h2></div>
        <p>Passing tests is one milestone. Predicting a state change and explaining why the code works gives stronger evidence of understanding. The next thing to measure is whether the learner can solve a new problem with the same pattern without hints. This walkthrough shows the coaching process, not a measured learning gain.</p>
        <LearningLink href="/topics/two-pointers">Try the full Two Pointers lesson</LearningLink>
      </section>
      <p className="coach-architecture"><strong>Under the hood:</strong> The chapter preparation flow is separate from the LangGraph practice router. Each practice question runs one specialist and then a solution guard, rather than asking all five coaches at once. The Python runner checks code; Viva grading is separate from the coach’s reply. When a model is unavailable, local coaches still give stage-specific hints.</p>
    </div>
  );
}
