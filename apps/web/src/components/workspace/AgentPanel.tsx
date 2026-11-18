"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { chatAgent } from "@/lib/api";

type Msg = { role: "user" | "agent"; agent?: string; text: string; question?: string | null };

type Props = {
  topic: string;
  problemId: string;
  stage: number;
  code: string;
  lastRun?: Record<string, unknown> | null;
};

export function AgentPanel({ topic, problemId, stage, code, lastRun }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      agent: "coordinator",
      text: "Ask about the concept or your latest trace. I will not paste a full solution.",
      question: "What invariant are you trying to maintain?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!input.trim() || busy) return;
    const userText = input.trim();
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
      });
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          agent: res.agent,
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
    <div className="flex h-full min-h-[280px] flex-col rounded-xl border border-[var(--line)] bg-white/70">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h3 className="font-semibold">Teaching agents</h3>
        <p className="text-xs text-[var(--muted)]">Concept Tutor · Feedback Agent · Coordinator</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "ml-6 bg-[var(--accent)]/10" : "mr-4 bg-[#f2f6f4]"
            }`}
          >
            {m.agent && (
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                {m.agent.replaceAll("_", " ")}
              </div>
            )}
            <p className="leading-relaxed">{m.text}</p>
            {m.question && (
              <p className="mt-2 border-t border-[var(--line)] pt-2 text-xs text-[var(--muted)]">
                Guiding question: {m.question}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-[var(--line)] p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask a hint-level question…"
          className="h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <Button onClick={send} disabled={busy}>
          {busy ? "…" : "Ask"}
        </Button>
      </div>
    </div>
  );
}
