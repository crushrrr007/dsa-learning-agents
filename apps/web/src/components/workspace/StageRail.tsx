"use client";

const STAGES = [
  { id: 1, label: "See" },
  { id: 2, label: "Predict" },
  { id: 3, label: "Code" },
  { id: 4, label: "Test" },
];

export function StageRail({ stage, onSelect }: { stage: number; onSelect: (s: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGES.map((s) => {
        const active = stage === s.id;
        const unlocked = stage >= s.id || s.id === 1;
        return (
          <button
            key={s.id}
            disabled={!unlocked && s.id > stage}
            onClick={() => onSelect(s.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--accent)] text-white"
                : unlocked
                  ? "bg-white/80 text-[var(--ink)] border border-[var(--line)]"
                  : "bg-black/5 text-[var(--muted)] opacity-60"
            }`}
          >
            {s.id}. {s.label}
          </button>
        );
      })}
    </div>
  );
}
