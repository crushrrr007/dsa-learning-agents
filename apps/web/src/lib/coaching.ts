import type { AgentReply } from "@/lib/api";

export const coachingNames: Record<string, string> = {
  concept_tutor: "Concept Tutor",
  demo_coach: "Demo Coach",
  predict_coach: "Predict Coach",
  code_mentor: "Code Mentor",
  viva_agent: "Viva Agent",
};

export const routingLabels: Record<AgentReply["routing_reason"], string> = {
  stage: "Matched the learning stage",
  question: "Matched a cue in the question",
  requested: "Selected by the learner",
};

export const replyLabels: Record<AgentReply["reply_source"], string> = {
  model: "Model reply",
  local: "Local coach reply",
  guard_fallback: "Guard fallback hint",
};

export function coachReplyText(response: AgentReply) {
  return response.reply_source === "local" ? response.reply.replace(/^\[[^\]\n]+\]\s*/, "") : response.reply;
}
