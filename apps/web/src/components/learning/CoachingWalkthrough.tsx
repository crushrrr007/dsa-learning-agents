"use client";

import { useState } from "react";
import { BookOpen, Code2, Eye, GitFork, MessageCircleQuestion, Play, ShieldCheck } from "lucide-react";
import { chatAgent, type AgentReply } from "@/lib/api";
import { coachingNames, coachReplyText, replyLabels, routingLabels } from "@/lib/coaching";

type WalkthroughStep = {
  id: string;
  stage: number;
  label: string;
  icon: typeof BookOpen;
  role: string;
  context: string;
  prompt: string;
  facts?: Record<string, unknown>;
};

const writtenHints = [
  "Two pointers track two positions at once. Before writing code, say what makes it safe to move one of them without revisiting the position you leave behind.",
  "At this frame, left is at 0 and right is at 4. In the next frame, compare their positions again. Which value changed first?",
  "Before advancing the trace, write down the next left and right positions. Explain which comparison would justify that move.",
  "An IndexError means an index is outside the list. Inspect both indices immediately before the failing line and check where either one last changed.",
  "Describe how often each pointer can move as the array grows. Then defend why your stopping condition still works when the pointers meet.",
];

type ExampleResult =
  | { kind: "loading" }
  | { kind: "live"; reply: AgentReply }
  | { kind: "error"; message: string };

const steps: WalkthroughStep[] = [
  { id: "concept_tutor", stage: 0, label: "Understand", icon: BookOpen, role: "Explains the pattern and the rule that must stay true, using the chapter notes rather than giving you code.", context: "The learner is new to Two Pointers and has not opened the editor.", prompt: "What should I pay attention to before I start?" },
  { id: "demo_coach", stage: 1, label: "See", icon: Eye, role: "Walks through the demo and points out which values to watch as Python runs.", context: "Sample trace frame: left is at index 0 and right is at index 4.", prompt: "What should I notice in this frame?", facts: { events: [{ line: 2, locals: { left: 0, right: 4 } }] } },
  { id: "predict_coach", stage: 2, label: "Predict", icon: GitFork, role: "Asks you to predict the next state and explain your choice before opening the editor.", context: "The learner has watched the demo and is deciding which pointer to move.", prompt: "How should I think about the next move without seeing the answer?" },
  { id: "code_mentor", stage: 3, label: "Code & test", icon: Code2, role: "Uses available runner output and code analysis to suggest one small thing to inspect instead of rewriting your code.", context: "Sample runner output: IndexError while reading a pointer position.", prompt: "My run failed. What should I inspect first?", facts: { error: "IndexError: list index out of range" } },
  { id: "viva_agent", stage: 4, label: "Viva", icon: MessageCircleQuestion, role: "Asks you to defend correctness, complexity, and edge cases after the tests pass. Chat does not mark a problem mastered.", context: "The learner’s tests have passed in this example; now they need to explain their approach.", prompt: "What time complexity should I be able to justify?" },
];

export function CoachingWalkthrough() {
  const [selected, setSelected] = useState(0);
  const [results, setResults] = useState<Partial<Record<number, ExampleResult>>>({});
  const [written, setWritten] = useState<number | null>(null);
  const step = steps[selected];
  const result = results[selected];
  const busy = result?.kind === "loading";
  const reply = result?.kind === "live" ? result.reply : null;
  const showWritten = written === selected || result?.kind === "error";

  async function runExample() {
    if (busy) return;
    const index = selected;
    setWritten(null);
    setResults((current) => ({ ...current, [index]: { kind: "loading" } }));
    try {
      const result = await chatAgent({
        problem_id: "squares-of-sorted-array",
        topic: "two-pointers",
        stage: step.stage,
        message: step.prompt,
        last_run: step.facts,
      });
      if (!result.reply || !routingLabels[result.routing_reason] || !replyLabels[result.reply_source]) {
        throw new Error("The live service did not return a complete decision trace.");
      }
      setResults((current) => ({ ...current, [index]: { kind: "live", reply: result } }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The coach could not reply.";
      setResults((current) => ({ ...current, [index]: { kind: "error", message } }));
    }
  }

  return (
    <section className="learn-panel coach-console" aria-labelledby="walkthrough-title">
      <header className="coach-console-head">
        <div><p className="learn-kicker">Live routing walkthrough</p><h2 id="walkthrough-title" className="font-serif">Follow one practice problem</h2></div>
        <span className="learn-pill">Two Pointers · Example</span>
      </header>
      <p className="coach-console-copy">Try a preset question from Squares of a Sorted Array. The context is a sample; the coordinator and reply are live. This does not change your progress.</p>
      <div className="coach-step-picker" role="group" aria-label="Choose a coaching stage">
        {steps.map(({ id, label, icon: Icon }, index) => (
          <button key={id} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setWritten(null); }}>
            <Icon size={19} aria-hidden="true" />
            <span><strong>{label}</strong><small>{coachingNames[id]}</small></span>
          </button>
        ))}
      </div>
      <div className="coach-console-grid">
        <div className="coach-example">
          <div><p className="learn-kicker">{step.label}</p><h3 className="font-serif">{coachingNames[step.id]}</h3><p>{step.role}</p></div>
          <dl className="coach-example-context"><div><dt>Example context</dt><dd>{step.context}</dd></div><div><dt>What the learner asks</dt><dd>{step.prompt}</dd></div></dl>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="learn-button" onClick={() => void runExample()} disabled={busy}><Play size={16} aria-hidden="true" /> {busy ? "Asking the coordinator…" : result?.kind === "error" ? "Retry live example" : "Run this example"}</button>
            {!showWritten && <button type="button" className="learn-text-link" onClick={() => setWritten(selected)}>Read a written example</button>}
            {written === selected && reply && <button type="button" className="learn-text-link" onClick={() => setWritten(null)}>Show live reply</button>}
          </div>
        </div>
        <div className="coach-receipt" aria-live="polite">
          <p className="coach-receipt-kicker"><ShieldCheck size={18} aria-hidden="true" /> {showWritten ? "Written example" : "Decision trace"}</p>
          {showWritten ? (
            <>
              {result?.kind === "error" && <p role="status">Live reply unavailable: {result.message}</p>}
              <p>{writtenHints[selected]}</p>
              <p className="coach-example-mode">This is an authored illustration, not a live reply or guard report.</p>
            </>
          ) : busy ? <p role="status">Waiting for the coordinator. You can explore another stage while it works.</p> : reply ? (
            <>
              <ol className="coach-receipt-list">
                <li><strong>Router</strong><span>{routingLabels[reply.routing_reason]}</span></li>
                <li><strong>Specialist</strong><span>{coachingNames[reply.agent] ?? reply.agent}</span></li>
                <li><strong>Solution guard</strong><span>{reply.guard_triggered ? "Revised or replaced the draft" : "No full solution flagged"}</span></li>
              </ol>
              <div className="coach-receipt-reply"><strong>{replyLabels[reply.reply_source]}</strong><p>{coachReplyText(reply)}</p>{reply.guiding_question && <p className="coach-followup"><strong>Try answering:</strong> {reply.guiding_question}</p>}</div>
            </>
          ) : <p>Run the example to see why a specialist was chosen, what it asked you to think about, and whether the solution guard intervened.</p>}
        </div>
      </div>
    </section>
  );
}
