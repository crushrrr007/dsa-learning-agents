"use client";

export type WorkspaceStageId = "see" | "predict" | "code" | "test" | "viva";

export const WORKSPACE_STAGES: {
  id: WorkspaceStageId;
  label: string;
  hint: string;
}[] = [
  { id: "see", label: "See", hint: "Watch the slow demo struggle on this input." },
  { id: "predict", label: "Predict", hint: "Name the next state before you write code." },
  { id: "code", label: "Code", hint: "Implement your approach in the editor." },
  { id: "test", label: "Test", hint: "Submit to run examples and hidden cases." },
  { id: "viva", label: "Viva", hint: "Defend complexity and edge cases to master." },
];

/** Map persisted backend stage (1–4) + UI flags → active workspace step. */
export function resolveActiveStage(opts: {
  stage: number;
  vivaReady: boolean;
  mastered: boolean;
  hasTestResults: boolean;
}): WorkspaceStageId {
  if (opts.mastered || opts.vivaReady) return "viva";
  if (opts.stage >= 3) return opts.hasTestResults ? "test" : "code";
  if (opts.stage >= 2) return "predict";
  return "see";
}

function stageUnlocked(id: WorkspaceStageId, stage: number, vivaReady: boolean): boolean {
  switch (id) {
    case "see":
      return true;
    case "predict":
      return stage >= 2;
    case "code":
      return stage >= 3;
    case "test":
      return stage >= 3;
    case "viva":
      return vivaReady;
  }
}

type Props = {
  stage: number;
  active: WorkspaceStageId;
  vivaReady: boolean;
  mastered: boolean;
  onSelect: (id: WorkspaceStageId) => void;
};

export function StageRail({ stage, active, vivaReady, mastered, onSelect }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Practice stages">
      {WORKSPACE_STAGES.map((step, i) => {
        const unlocked = stageUnlocked(step.id, stage, vivaReady || mastered);
        const isActive = active === step.id && unlocked;
        const done =
          (step.id === "see" && stage >= 2) ||
          (step.id === "predict" && stage >= 3) ||
          ((step.id === "code" || step.id === "test") && (vivaReady || mastered)) ||
          (step.id === "viva" && mastered);
        return (
          <li key={step.id}>
            <button
              type="button"
              aria-current={isActive ? "step" : undefined}
              disabled={!unlocked}
              onClick={() => onSelect(step.id)}
              title={unlocked ? step.hint : "Finish the previous stage first"}
              className={`flex min-h-9 items-center gap-1 rounded-md border px-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--surface)]"
                  : done
                    ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : unlocked
                      ? "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]"
                      : "cursor-not-allowed border-transparent bg-[var(--bg)] text-[var(--muted)]"
              }`}
            >
              <span aria-hidden="true" className="text-xs tabular-nums opacity-75">{i + 1}.</span> {step.label}
              <span className="sr-only">{!unlocked ? " (locked)" : done ? " (completed)" : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function nextActionCopy(opts: {
  active: WorkspaceStageId;
  mastered: boolean;
}): { title: string; body: string; cta?: string } {
  if (opts.mastered) {
    return {
      title: "Mastered",
      body: "You finished See → Predict → Code → Test → Viva. Pick another problem or reset for a fresh demo.",
    };
  }
  if (opts.active === "viva") {
    return {
      title: "Viva unlocked",
      body: "Answer the oral checks in Learn path. Agents won’t dump a full solution — defend your approach.",
      cta: "Open viva",
    };
  }
  if (opts.active === "see") {
    return {
      title: "Start with See",
      body: "Run the brute-force demo so you can watch the slow approach fail before you code.",
      cta: "Run demo",
    };
  }
  if (opts.active === "predict") {
    return {
      title: "Predict next",
      body: "Fill in each prediction step. The editor stays locked until you finish them.",
      cta: "Go to predict",
    };
  }
  if (opts.active === "code" || opts.active === "test") {
    return {
      title: "Code, then Submit",
      body: "Run for a quick check. Submit runs examples + hidden tests. You only unlock viva on a full pass.",
      cta: "Focus editor",
    };
  }
  return {
    title: "Keep going",
    body: "Follow the stage rail left to right. Ask Hint if you stall — not for the full answer.",
  };
}
