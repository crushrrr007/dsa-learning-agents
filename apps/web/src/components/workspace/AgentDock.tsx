"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { chatAgent } from "@/lib/api";

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
}[] = [
  {
    id: "concept_tutor",
    short: "Hint",
    title: "Concept Tutor",
    blurb: "Pattern & invariant — no full solutions.",
    starter: "Explain the core pattern for this problem in plain words.",
  },
  {
    id: "demo_coach",
    short: "Demo",
    title: "Demo Coach",
    blurb: "Walk through the brute-force / demo trace.",
    starter: "What should I watch for in the demo trace?",
  },
  {
    id: "predict_coach",
    short: "Predict",
    title: "Predict Coach",
    blurb: "Check your next-step predictions.",
    starter: "Help me predict the next pointer move.",
  },
  {
    id: "code_mentor",
    short: "Debug",
    title: "Code Mentor",
    blurb: "Debug from AST, errors, and failing tests.",
    starter: "My last run failed — what should I inspect first?",
  },
  {
    id: "viva_agent",
    short: "Viva",
    title: "Viva Agent",
    blurb: "Complexity & edge-case interview probes.",
    starter: "Ask me a viva question about this approach.",
  },
];

type Msg = {
  role: "user" | "agent";
  agent?: string;
  agentLabel?: string | null;
  text: string;
  question?: string | null;
};

type Props = {
  topic: string;
  problemId: string;
  stage: number;
  code: string;
  lastRun?: Record<string, unknown> | null;
  defaultAgent?: AgentId;
};

export function AgentDock({ topic, problemId, stage, code, lastRun, defaultAgent }: Props) {
  const initial = defaultAgent || AGENTS[Math.min(Math.max(stage, 0), 4)].id;
  const [active, setActive] = useState<AgentId>(initial);
  const meta = useMemo(() => AGENTS.find((a) => a.id === active) || AGENTS[0], [active]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      agent: meta.id,
      text: `${meta.title} ready. ${meta.blurb}`,
      question: "What do you want to understand next?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llmMode, setLlmMode] = useState<string | null>(null);

  function switchAgent(id: AgentId) {
    const next = AGENTS.find((a) => a.id === id) || AGENTS[0];
    setActive(id);
    setMessages([
      {
        role: "agent",
        agent: next.id,
        text: `Switched to ${next.title}. ${next.blurb}`,
        question: "Ask a focused question — I will not paste a full solution.",
      },
    ]);
    setInput("");
  }

  async function send(text?: string) {
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
        preferred_agent: active,
      });
      if (res.llm_mode) setLlmMode(res.llm_mode);
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          agent: res.agent,
          agentLabel: res.agent_label,
          text: res.reply,
          question: res.guiding_question,
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
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[#0f1419] text-[#e7ecf1]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b9aab]">Agents</p>
          <p className="text-sm font-semibold text-white">{meta.title}</p>
        </div>
        {llmMode && <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">{llmMode}</span>}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => switchAgent(a.id)}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              active === a.id ? "bg-[var(--accent)] text-white" : "bg-white/5 text-[#b7c2ce] hover:bg-white/10"
            }`}
          >
            {a.short}
          </button>
        ))}
      </div>

      <p className="border-b border-white/10 px-3 py-2 text-[11px] text-[#8b9aab]">{meta.blurb}</p>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-md px-3 py-2 text-sm leading-relaxed ${
              m.role === "user" ? "ml-6 bg-[var(--accent)]/25" : "mr-4 bg-white/5"
            }`}
          >
            {m.agent && m.role === "agent" && (
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#7dcea0]">
                {(m.agentLabel || m.agent).replaceAll("_", " ").split("—")[0].trim()}
              </div>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.question && (
              <p className="mt-2 border-t border-white/10 pt-2 text-xs text-[#8b9aab]">Q: {m.question}</p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => send(meta.starter)}
          disabled={busy}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-[#b7c2ce] hover:bg-white/10"
        >
          Quick ask: {meta.starter}
        </button>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Ask ${meta.short}…`}
            className="h-10 flex-1 rounded-md border border-white/10 bg-[#161c23] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <Button onClick={() => send()} disabled={busy}>
            {busy ? "…" : "Ask"}
          </Button>
        </div>
      </div>
    </div>
  );
}
