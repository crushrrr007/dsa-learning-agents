# Pointer Lab — Multi-Agent DSA Learning Platform

University-lab workspace for learning DSA with **real Python tracing** and **teaching agents** that hint instead of dumping solutions.

## Pilot path (start here)

1. Open **Home** → **Start Two Pointers** (or nav **Pilot**).
2. **Diagnose** → soft plan → brief overview.
3. Open the **recommended problem**.
4. Finish the locked loop: **See → Predict → Code → Test → Viva**.
5. Use **Progress → Reset session** before a fresh demo.

Viva unlocks only when **all** tests pass. Agents are stage-aware and blocked from pasting full solutions.

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
