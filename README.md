# Pointer Lab — Multi-Agent DSA Learning Platform

University-lab workspace for learning DSA with **real Python tracing** and **teaching agents** that hint instead of dumping solutions.

## Goal

**Showcase a multi-agent DSA lab:** specialized coaches (Concept, Demo, Predict, Code, Viva) improve learning vs a single chatbot that dumps answers. See **[AGENTS.md](./AGENTS.md)** for how routing and the solution guard work.

## Product shape (NeetCode × TakeYouForward × AlgoMaster × agents)

| Borrow | Where in Pointer Lab |
|--------|----------------------|
| NeetCode list + editor | `/problems` sheet + dark `/problems/[id]` workspace |
| TakeYouForward ordered sheet/progress | Topic diagnose→plan, Core sheet, Progress % |
| AlgoMaster patterns | `/patterns` explore + sheet filters + related problems |
| **Our flavor** | Five coaches + See→Predict→Code→Test→Viva (no solution dumps) |

See **[PLATFORM.md](./PLATFORM.md)** for the full completion roadmap (P0–P5).

## Pilot path (start here)

1. Open **Home** → **Start Two Pointers** (or nav **Demo**).
2. **Diagnose** → soft plan → brief overview.
3. Open the **recommended problem** (usually **Valid Palindrome**).
4. Finish the locked loop: **See → Predict → Code → Test → Viva**.
5. Browse **Sheet** (`/problems`) or **Core** curated list; use **Progress → Reset** before a fresh demo.

Viva unlocks only when **all** tests pass. Agents are stage-aware and blocked from pasting full solutions.

## Professor demo script (~8–12 min)

**Setup:** API `:8417`, web `:3417`, `GROQ_API_KEY` set, Progress → **Reset session**.

| Beat | Show |
|------|------|
| 1. Positioning | Home: practice sheet + pattern graph. Pitch: NeetCode workspace + ordered path + **multi-agent coaches** that refuse solution dumps. |
| 2. Path | **Pilot** → Two Pointers diagnose (miss one MCQ) → soft plan + Before you code → overview → **recommended problem**. |
| 3. Stages | Workspace stage rail. **See** brute demo + Visual tab. **Predict** steps → editor unlocks. |
| 4. Agents | Ask **Hint** / **Predict** / **Debug** with Groq live. Point out stage-suggested coach + no full solution. |
| 5. Submit | Paste a correct solution (or finish coding). Fail once if you want gating; then full pass → **Viva**. |
| 6. Close | Mastered on Progress. Reset for the next visitor. |

**Talking point:** Same LeetCode-like editor professors know — differentiated by See/Predict gates, viva rubrics, and LangGraph coaches with a solution-leak guard.

## Curriculum

**73 problems** across 9 topics:

| Topic | Problems |
|-------|----------|
| Arrays | 12 |
| Two Pointers | 7 |
| Sliding Window | 7 |
| Linked Lists | 8 |
| Stack | 5 |
| Trees | 10 |
| Graphs | 8 |
| Dynamic Programming | 10 |
| Binary Search | 6 |

Flow for every problem:
1. See (brute demo)  
2. Predict steps  
3. Code and trace  
4. Test (examples + hidden)  
5. Viva → mastery  

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, TypeScript, Tailwind, Monaco, React Flow |
| Backend | FastAPI, LangGraph coordinator, ChromaDB notes |
| Runner | Sandboxed Python (`sys.settrace` + `ast`); optional Docker |
| Storage | SQLite (attempts, stage unlocks, mastery) |

## Quick start

### API (port 8417)

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8417
```

### Web (port 3417)

```bash
cd apps/web
npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:8417 npm run dev
```

Optional LLM (OpenAI-compatible; **Groq free tier** is the default host):

```bash
# Get a free key at https://console.groq.com
export GROQ_API_KEY=gsk_...
# or: export LLM_API_KEY=...
# optional overrides:
# export LLM_BASE_URL=https://api.groq.com/openai/v1
# export LLM_MODEL=openai/gpt-oss-20b
```

Without a key, teaching agents use deterministic mock coaches (still stage-routed).

**Five agents:** Concept Tutor → Demo Coach → Predict Coach → Code Mentor → Viva Agent.

Optional Docker runner (subprocess is default):

```bash
export DSA_USE_DOCKER=1
export DSA_DOCKER_IMAGE=python:3.12-slim
```

## Product shape

- **One-door topic path** — Diagnose → soft Plan → Teach overview → Practice  
- **Problem workspace** — description | editor + tests | stage rail + next-action banner | skinned agents  
- **Visual pattern roadmap** — React Flow graph (optional; pilots can ignore)  
- **KG memory** — diagnostic/attempt/mastery edges inform plans and the home graph  
- **Solution privacy** — public problem payload strips reference solutions; LangGraph guard blocks leaky coach replies  

## Tests

```bash
cd apps/api && uv run pytest -q
```

## Repo layout

```
apps/web/       Next.js UI
apps/api/       FastAPI + runner + agents
content/        Problems, notes, quizzes, roadmap
```
