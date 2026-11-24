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
  testsPassed: boolean;
  vivaReady: boolean;
  mastered: boolean;
}): WorkspaceStageId {
  if (opts.mastered) return "viva";
  if (opts.vivaReady || opts.testsPassed) return "viva";
  // After Predict unlocks the editor, land on Code — not Test.
  if (opts.stage >= 3) return "code";
  if (opts.stage >= 2) return "predict";
  return "see";
}

export function stageUnlocked(
  id: WorkspaceStageId,
  stage: number,
  testsPassed: boolean,
  vivaReady: boolean,
): boolean {
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
      return testsPassed || vivaReady || stage >= 4;
  }
}

type Props = {
  stage: number;
  active: WorkspaceStageId;
  testsPassed: boolean;
  vivaReady: boolean;
  mastered: boolean;
  onSelect: (id: WorkspaceStageId) => void;
};

export function StageRail({
  stage,
  active,
  testsPassed,
  vivaReady,
  mastered,
  onSelect,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Practice stages">
      {WORKSPACE_STAGES.map((s, i) => {
        const unlocked = stageUnlocked(s.id, stage, testsPassed, vivaReady) || s.id === "see";
        const isActive = active === s.id;
        const done =
          (s.id === "see" && stage >= 2) ||
          (s.id === "predict" && stage >= 3) ||
          (s.id === "code" && stage >= 3) ||
          (s.id === "test" && (testsPassed || vivaReady || stage >= 4)) ||
          (s.id === "viva" && mastered);

        return (
          <div key={s.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <span
                className={`hidden h-px w-3 sm:block ${done || isActive ? "bg-[var(--accent)]/40" : "bg-[var(--line)]"}`}
                aria-hidden
              />
            )}
            <button
              type="button"
              role="listitem"
              disabled={!unlocked}
              onClick={() => unlocked && onSelect(s.id)}
              title={unlocked ? s.hint : "Locked — finish the previous stage first"}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                isActive
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : done
                    ? "border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : unlocked
                      ? "border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)]"
                      : "cursor-not-allowed bg-black/5 text-[var(--muted)] opacity-55"
              }`}
            >
              <span className="tabular-nums opacity-70">{i + 1}.</span> {s.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function nextActionCopy(opts: {
  active: WorkspaceStageId;
  stage: number;
  testsPassed: boolean;
  vivaReady: boolean;
  mastered: boolean;
  predictDone: boolean;
}): { title: string; body: string; cta?: string } {
  if (opts.mastered) {
    return {
      title: "Mastered",
      body: "You finished See → Predict → Code → Test → Viva. Pick another problem or reset for a fresh demo.",
    };
  }
  if (opts.active === "viva" || opts.vivaReady || opts.testsPassed || opts.stage >= 4) {
    return {
      title: "Viva unlocked",
      body: "Answer the oral checks on the Stages tab. Coaches hint — they never paste a full solution.",
      cta: "Open viva",
    };
  }
  if (opts.stage < 2) {
    return {
      title: "Start with See",
      body: "Run the brute-force demo so you can watch the slow approach fail before you code.",
      cta: "Run demo",
    };
  }
  if (opts.stage < 3 || !opts.predictDone) {
    return {
      title: "Predict next",
      body: "Fill in each prediction step. The editor stays locked until you finish them.",
      cta: "Go to predict",
    };
  }
  if (opts.active === "test") {
    return {
      title: "Submit tests",
      body: "Submit runs examples + hidden cases. Viva unlocks only when every case passes.",
      cta: "Focus editor",
    };
  }
  return {
    title: "Code your approach",
    body: "Write the solution, Run for a quick check, then Submit. Ask Debug if a test fails.",
    cta: "Focus editor",
  };
}
