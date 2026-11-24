"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WORKSPACE_AGENTS, type AgentId } from "@/lib/agents";
import { chatAgent } from "@/lib/api";

export type { AgentId };

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
  /** Soft highlight for the coach that matches the current workspace stage. */
  suggestedAgent?: AgentId;
  /** Optional one-shot prompt (e.g. after a failed submit). */
  seedAsk?: string | null;
  onSeedConsumed?: () => void;
};

export function AgentDock({
  topic,
  problemId,
  stage,
  code,
  lastRun,
  defaultAgent,
  suggestedAgent,
  seedAsk,
  onSeedConsumed,
}: Props) {
  const initial = defaultAgent || WORKSPACE_AGENTS[Math.min(Math.max(stage, 0), 4)].id;
  const [active, setActive] = useState<AgentId>(initial);
  const meta = useMemo(() => WORKSPACE_AGENTS.find((a) => a.id === active) || WORKSPACE_AGENTS[0], [active]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      agent: meta.id,
      text: `${meta.title} ready. ${meta.job}`,
      question: meta.empty,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llmMode, setLlmMode] = useState<string | null>(null);
  const recommend = suggestedAgent || defaultAgent;
  const userPicked = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  function switchAgent(id: AgentId, fromUser = true) {
    const next = WORKSPACE_AGENTS.find((a) => a.id === id) || WORKSPACE_AGENTS[0];
    if (fromUser) userPicked.current = true;
    setActive(id);
    setMessages([
      {
        role: "agent",
        agent: next.id,
        text: fromUser
          ? `Switched to ${next.title}. ${next.job}`
          : `${next.title} is on deck for this stage. ${next.job}`,
        question: next.empty,
      },
    ]);
    setInput("");
  }

  useEffect(() => {
    userPicked.current = false;
  }, [problemId]);

  useEffect(() => {
    if (!suggestedAgent || userPicked.current) return;
    if (suggestedAgent === active) return;
    switchAgent(suggestedAgent, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to stage suggestion
  }, [suggestedAgent, problemId]);

  useEffect(() => {
    if (!seedAsk?.trim()) return;
    void send(seedAsk);
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedAsk]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

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
    <div
      className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border text-[#e7ecf1]"
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
            Coach · {meta.stage}
          </p>
          <p className="truncate text-sm font-semibold text-white">{meta.title}</p>
        </div>
        {llmMode && (
          <span
            className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70"
            style={{ background: meta.accentSoft }}
          >
            {llmMode}
          </span>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2">
        {WORKSPACE_AGENTS.map((a) => {
          const isRec = recommend === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => switchAgent(a.id)}
              className="relative shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition"
              style={
                active === a.id
                  ? { background: a.accent, color: "#fff" }
                  : isRec
                    ? { background: a.accentSoft, color: "#e7ecf1", boxShadow: `inset 0 0 0 1px ${a.accent}` }
                    : { background: "rgba(255,255,255,0.06)", color: "#b7c2ce" }
              }
              title={isRec ? `Suggested for ${a.stage}` : a.blurb}
            >
              {a.short}
              {isRec && active !== a.id && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full" style={{ background: a.accent }} />
              )}
            </button>
          );
        })}
      </div>

      <p className="border-b border-white/10 px-3 py-2 text-[11px] leading-relaxed text-[#a8b4c0]">
        {meta.job}
        {recommend === active ? " · Best fit for your current stage." : null}
      </p>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
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
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.question && (
              <p className="mt-2 border-t border-white/10 pt-2 text-xs text-[#8b9aab]">Q: {m.question}</p>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-white/40">Coach is thinking…</p>}
      </div>

      <div className="space-y-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => send(meta.starter)}
          disabled={busy}
          className="w-full rounded-md border border-white/10 px-3 py-1.5 text-left text-xs text-[#b7c2ce] hover:bg-white/10 disabled:opacity-50"
        >
          Quick ask: {meta.starter}
        </button>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={`Ask ${meta.short}…`}
            className="h-10 flex-1 rounded-md border border-white/10 bg-[#161c23] px-3 text-sm text-white outline-none"
            style={{ boxShadow: busy ? undefined : `inset 0 0 0 1px ${meta.accent}33` }}
          />
          <Button onClick={() => send()} disabled={busy} style={{ background: meta.accent }}>
            {busy ? "…" : "Ask"}
          </Button>
        </div>
        <p className="text-[10px] text-white/35">Hints only — solution dumps are blocked by the guard.</p>
      </div>
    </div>
  );
}
