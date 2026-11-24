"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { chatAgent } from "@/lib/api";
import { coachingNames, coachReplyText, replyLabels, routingLabels } from "@/lib/coaching";

export type AgentId =
  | "concept_tutor"
  | "demo_coach"
  | "predict_coach"
  | "code_mentor"
  | "viva_agent";

const AGENTS: {
  id: AgentId;
  short: string;
  title: string;
  blurb: string;
  starter: string;
  accent: string;
  accentSoft: string;
  letter: string;
  empty: string;
}[] = [
  {
    id: "concept_tutor",
    short: "Hint",
    title: "Concept Tutor",
    blurb: "Pattern & invariant — no full solutions.",
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
    starter: "Ask me a viva question about this approach.",
    accent: "#9a3412",
    accentSoft: "rgba(154,52,18,0.2)",
    letter: "V",
    empty: "Ready when you want to defend complexity or edges.",
  },
];

type Msg = {
  role: "user" | "agent";
  agent?: string;
  agentLabel?: string | null;
  text: string;
  question?: string | null;
  attribution?: string;
};

type Props = {
  topic: string;
  problemId: string;
  stage: number;
  code: string;
  lastRun?: Record<string, unknown> | null;
  /** Soft highlight for the coach that matches the current workspace stage. */
  suggestedAgent?: AgentId;
  contextualPrompt?: { text: string; agent: AgentId } | null;
};

export function AgentDock({
  topic,
  problemId,
  stage,
  code,
  lastRun,
  suggestedAgent,
  contextualPrompt,
}: Props) {
  const [override, setOverride] = useState<AgentId | null>(null);
  const recommend = suggestedAgent || AGENTS[Math.min(Math.max(stage, 0), 4)].id;
  const active = override || recommend;
  const meta = AGENTS.find((agent) => agent.id === active) ?? AGENTS[0];
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  async function send(text?: string, agent?: AgentId) {
    const userText = (text ?? input).trim();
    if (!userText || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setBusy(true);
    try {
      const res = await chatAgent({
        topic,
        problem_id: problemId,
        stage,
        message: userText,
        code,
        last_run: lastRun || undefined,
        preferred_agent: agent ?? override ?? undefined,
      });
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          agent: res.agent,
          agentLabel: coachingNames[res.agent] ?? res.agent_label,
          text: coachReplyText(res),
          question: res.guiding_question,
          attribution: [routingLabels[res.routing_reason], replyLabels[res.reply_source], res.guard_triggered ? "Guard intervened" : null].filter(Boolean).join(" · "),
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          agent: "system",
          text: e instanceof Error ? e.message : "Agent unavailable",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border text-[#e7ecf1]"
      style={{
        borderColor: meta.accent + "66",
        background: `linear-gradient(165deg, ${meta.accentSoft} 0%, #0f1419 42%, #0f1419 100%)`,
      }}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black text-white"
          style={{ background: meta.accent }}
        >
          {meta.letter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: meta.accent }}>
            {override ? "Selected coach" : "Suggested for this stage"}
          </p>
          <p className="truncate text-sm font-semibold text-white">{meta.title}</p>
        </div>
        <Link href="/agents" className="text-xs font-semibold text-white/80 underline underline-offset-4">How it works</Link>
      </div>

      <div role="group" aria-label="Coach preference" className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
        <button type="button" aria-pressed={!override} onClick={() => setOverride(null)} disabled={busy} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold ${!override ? "bg-[var(--accent)] text-[var(--surface)]" : "bg-[var(--surface)]/10 text-[var(--surface)]"}`}>Auto</button>
        {AGENTS.map((a) => {
          const isRec = recommend === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={override === a.id}
              onClick={() => setOverride(a.id)}
              disabled={busy}
              className="relative shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition"
              style={
                override === a.id
                  ? { background: a.accent, color: "#fff" }
                  : isRec
                    ? { background: a.accentSoft, color: "#e7ecf1", boxShadow: `inset 0 0 0 1px ${a.accent}` }
                    : { background: "rgba(255,255,255,0.06)", color: "#b7c2ce" }
              }
              title={isRec ? "Suggested for this stage" : a.blurb}
            >
              {a.short}
              {isRec && active !== a.id && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: a.accent }} />
              )}
            </button>
          );
        })}
      </div>

      <p className="border-b border-white/10 px-3 py-2 text-[11px]" style={{ color: "#a8b4c0" }}>
        {override ? meta.blurb : "Auto picks a specialist from your question and current stage."}
      </p>

      <div ref={logRef} role="log" aria-label="Coach messages" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && <p className="text-xs text-white/50">{meta.empty}</p>}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-md px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "ml-6" : "mr-4"}`}
            style={
              m.role === "user"
                ? { background: meta.accentSoft }
                : { background: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${meta.accent}` }
            }
          >
            {m.agent && m.role === "agent" && (
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.accent }}>
                {(m.agentLabel || m.agent).replaceAll("_", " ").split("—")[0].trim()}
              </div>
            )}
            {m.attribution && <p className="mb-1 text-xs text-[var(--surface)]/75">{m.attribution}</p>}
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
            {m.question && (
              <p className="mt-2 border-t border-white/10 pt-2 text-xs text-[#8b9aab]">Q: {m.question}</p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => send(contextualPrompt?.text ?? meta.starter, contextualPrompt?.agent)}
          disabled={busy}
          className="w-full rounded-md border border-white/10 px-3 py-1.5 text-left text-xs text-[#b7c2ce] hover:bg-white/10"
        >
          {contextualPrompt ? `Ask ${coachingNames[contextualPrompt.agent]}: ${contextualPrompt.text}` : `Quick ask: ${meta.starter}`}
        </button>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) void send();
            }}
            aria-label="Question for the coaches"
            placeholder={override ? `Ask ${meta.short}…` : "Ask a coach…"}
            className="h-10 flex-1 rounded-md border border-white/10 bg-[#161c23] px-3 text-sm text-white outline-none"
            style={{ boxShadow: busy ? undefined : `inset 0 0 0 1px ${meta.accent}33` }}
          />
          <Button onClick={() => send()} disabled={busy} style={{ background: meta.accent }}>
            {busy ? "…" : "Ask"}
          </Button>
        </div>
      </div>
    </div>
  );
}
