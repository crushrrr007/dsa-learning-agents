# How Pointer Lab’s multi-agent system works

**Goal:** show that a *team of specialized coaches* improves DSA learning more than a single chatbot that dumps solutions.

## Learning loop (workspace)

```
See → Predict → Code → Test → Viva
```

Each stage soft-locks the next. Agents **hint**; a **solution guard** blocks full code pastes.

## Workspace coaches (5)

| Agent | UI chip | Stage | What it does | Grounding |
|-------|---------|-------|--------------|-----------|
| **Concept Tutor** | Hint | Anytime | Pattern + invariant from notes | Topic markdown notes |
| **Demo Coach** | Demo | See | Narrates brute-force / demo trace | Trace frames from runner |
| **Predict Coach** | Predict | Predict | Helps forecast next state | Predict prompts + hints |
| **Code Mentor** | Debug | Code / Test | Next micro-fix from failures | AST, stderr, test diffs |
| **Viva Agent** | Viva | Viva | Complexity / edge oral probes | Rubric viva after tests pass |

**Routing:** the UI picks a coach (preferred). If you leave it open, LangGraph routes by stage and keywords (`choose_agent` in `apps/api/app/agents/coordinator.py`). After every reply, `guard_node` checks for leaked solutions and regenerates or falls back.

**LLM:** Groq/OpenAI when a key is set; otherwise deterministic local coaches so demos still work.

## Topic-entry agents (3)

Used on `/topics/[slug]` before a problem:

| Agent | Job |
|-------|-----|
| Diagnostic | Prerequisite check |
| Plan | Soft ordered path (review / recommended / optional) |
| Teach | Short overview |

## Why this is better for learning

1. **Specialization** — Demo Coach is not asked to debug AST; Code Mentor is not asked for viva.
2. **Stage lock** — you cannot skip straight to coding without seeing and predicting.
3. **No answer dump** — guard + rubric viva force understanding for “mastered.”
4. **Shared facts** — coaches see the same runner/trace context as the editor.
5. **AlgoMaster-style visuals** — free step animation of arrays/pointers/trees (paid elsewhere) tied to Demo Coach.

## Learning path (topic)

`Diagnose → Plan → Teach → Practice` maps to Diagnostic / Plan / Teach agents, then workspace coaches.

## Where to look in code

- Graph: `apps/api/app/agents/coordinator.py`
- Roles / mocks: `apps/api/app/agents/llm.py`
- Leak guard: `apps/api/app/agents/solution_guard.py`
- UI dock: `apps/web/src/components/workspace/AgentDock.tsx`
- Catalog copy: `apps/web/src/lib/agents.ts`
