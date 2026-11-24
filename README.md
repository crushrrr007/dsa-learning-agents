# Pointer Lab — Multi-Agent DSA Learning Platform

University-lab workspace for learning DSA with **real Python tracing** and **teaching agents** that hint instead of dumping solutions.

## Goal

Showcase how specialized coaches support learning without dumping solutions. See [AGENTS.md](./AGENTS.md) for routing and the solution guard, and [PLATFORM.md](./PLATFORM.md) for the roadmap.

## Start learning

- **Today** recommends a chapter, a problem from your plan, or the practice you left unfinished.
- **Learn** offers Foundations and Interview Patterns; `/patterns` adds searchable pattern mastery.
- **Practice** offers shareable catalog filters. `/problems` is the full sheet and `/sheets/pointer-lab-core` is the curated Core track.
- **Agents** demonstrates the live coach router. **Progress** distinguishes Solved from Mastered and tracks completed overviews.

For the sample, choose **Today → Try the Two Pointers sample → Take the diagnostic**. Open the recommended problem and finish **See → Predict → Code → Test → Viva**. For a fresh demo, use **Progress → Reset guest progress**.

Viva unlocks only when **all** tests pass. Agents are stage-aware and blocked from pasting full solutions.

## Professor demo script (~8–12 min)

**Setup:** API `:8417`, web `:3417`, `GROQ_API_KEY` set, Progress → **Reset session**.

| Beat | Show |
|------|------|
| 1. Positioning | Today: practice sheet, Core and pattern exploration, plus **multi-agent coaches** that refuse solution dumps. |
| 2. Path | **Two Pointers sample** → diagnostic → soft plan + Before you code → overview → **recommended problem**. |
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
uv sync --locked
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8417
```

### Web (port 3417)

```bash
cd apps/web
npm ci
npm run dev
```

Open `http://localhost:3417`. The web app forwards lab requests to `http://127.0.0.1:8417` by default. Set `LAB_API_URL` in the Next.js server environment if the backend runs elsewhere. Keep the default subprocess runner for trusted local practice only; do not rely on it as a public execution boundary.

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
- **Learning roadmap** — ordered chapters and a browsable pattern library
- **KG memory** — diagnostic, attempt, and mastery signals inform plans independently of the UI
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
