/** Shared catalog: workspace dock + home showcase use the same story. */

export type AgentId =
  | "concept_tutor"
  | "demo_coach"
  | "predict_coach"
  | "code_mentor"
  | "viva_agent";

export type AgentMeta = {
  id: AgentId;
  short: string;
  title: string;
  blurb: string;
  job: string;
  when: string;
  stage: string;
  starter: string;
  accent: string;
  accentSoft: string;
  letter: string;
  empty: string;
};

export const WORKSPACE_AGENTS: AgentMeta[] = [
  {
    id: "concept_tutor",
    short: "Hint",
    title: "Concept Tutor",
    blurb: "Pattern & invariant — no full solutions.",
    job: "Teaches the pattern from topic notes. Forces you to name the invariant before coding.",
    when: "Before or during a problem, when you are lost on the idea.",
    stage: "Anytime · strong on entry",
    starter: "Explain the core pattern for this problem in plain words.",
    accent: "#0b6e5f",
    accentSoft: "rgba(11,110,95,0.18)",
    letter: "H",
    empty: "Ask what must stay true after each step.",
  },
  {
    id: "demo_coach",
    short: "Demo",
    title: "Demo Coach",
    blurb: "Walk through the brute-force / demo trace.",
    job: "Narrates the See-stage trace: why the slow approach struggles and what to watch in each frame.",
    when: "During See, after you run the brute-force demo.",
    stage: "See",
    starter: "What should I watch for in the demo trace?",
    accent: "#1d4e89",
    accentSoft: "rgba(29,78,137,0.18)",
    letter: "D",
    empty: "Run a demo, then ask which frame matters.",
  },
  {
    id: "predict_coach",
    short: "Predict",
    title: "Predict Coach",
    blurb: "Check your next-step predictions.",
    job: "Helps you forecast the next pointer/state change — confirms or nudges without spoiling.",
    when: "During Predict, before the editor unlocks.",
    stage: "Predict",
    starter: "Help me predict the next pointer move.",
    accent: "#7c3aed",
    accentSoft: "rgba(124,58,237,0.18)",
    letter: "P",
    empty: "Name the next state change before you peek.",
  },
  {
    id: "code_mentor",
    short: "Debug",
    title: "Code Mentor",
    blurb: "Debug from AST, errors, and failing tests.",
    job: "Reads runner facts (errors, failing cases, AST hints) and suggests the next micro-fix — never a rewrite.",
    when: "During Code & Test, especially after a failed Run/Submit.",
    stage: "Code · Test",
    starter: "My last run failed — what should I inspect first?",
    accent: "#b45309",
    accentSoft: "rgba(180,83,9,0.18)",
    letter: "X",
    empty: "Paste a failure in your question after Run/Submit.",
  },
  {
    id: "viva_agent",
    short: "Viva",
    title: "Viva Agent",
    blurb: "Complexity & edge-case interview probes.",
    job: "Oral-exam style probes on complexity, edges, and defending your approach after tests pass.",
    when: "After all tests pass — viva unlocks mastery.",
    stage: "Viva",
    starter: "Ask me a viva question about this approach.",
    accent: "#9a3412",
    accentSoft: "rgba(154,52,18,0.2)",
    letter: "V",
    empty: "Ready when you want to defend complexity or edges.",
  },
];

/** Topic-entry agents (diagnose → plan → overview) — separate from workspace coaches. */
export const TOPIC_AGENTS = [
  {
    id: "diagnostic_agent",
    title: "Diagnostic",
    job: "Short quiz on prerequisites before a topic.",
  },
  {
    id: "plan_agent",
    title: "Plan",
    job: "Builds a soft ordered practice path from your gaps.",
  },
  {
    id: "teach_agent",
    title: "Teach",
    job: "Brief topic overview before you open a problem.",
  },
] as const;

export function agentForWorkspaceStage(
  stage: "see" | "predict" | "code" | "test" | "viva" | string,
): AgentId {
  switch (stage) {
    case "see":
      return "demo_coach";
    case "predict":
      return "predict_coach";
    case "code":
    case "test":
      return "code_mentor";
    case "viva":
      return "viva_agent";
    default:
      return "concept_tutor";
  }
}
