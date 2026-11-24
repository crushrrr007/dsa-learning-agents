import { Check, Circle, CircleDot } from "lucide-react";
import type { WorkspaceStageId } from "./StageRail";

const milestones: { id: WorkspaceStageId; title: string; evidence: string }[] = [
  { id: "see", title: "See", evidence: "Watch state change in a real Python trace." },
  { id: "predict", title: "Predict", evidence: "Explain what changes next before writing code." },
  { id: "code", title: "Code", evidence: "Run your Python and inspect the executed line." },
  { id: "test", title: "Test", evidence: "Pass the visible and private checks." },
  { id: "viva", title: "Viva", evidence: "Defend the approach, an edge case, and its complexity." },
];

export function LearningChecklist({ active, stage, ranCode, mastered }: { active: WorkspaceStageId; stage: number; ranCode: boolean; mastered: boolean }) {
  const completed = [stage >= 2, stage >= 3, ranCode || stage >= 4, stage >= 4, mastered];
  return <section className="learning-checklist" aria-labelledby="learning-checklist-title">
    <div><p className="learn-kicker">Guided practice</p><h3 id="learning-checklist-title" className="font-serif">What you’re learning</h3></div>
    <ol>{milestones.map(({ id, title, evidence }, index) => {
      const done = completed[index];
      const current = !done && id === active;
      const Icon = done ? Check : current ? CircleDot : Circle;
      return <li key={id} aria-current={current ? "step" : undefined} data-complete={done}><Icon size={17} aria-hidden="true" /><div><strong>{title}</strong><p>{evidence}</p></div><span>{done ? "Done" : current ? "Now" : "Next"}</span></li>;
    })}</ol>
    <p>Specialist hints and trace review are available in this guest lab.</p>
  </section>;
}
