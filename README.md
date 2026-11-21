# Pointer Lab — Multi-Agent DSA Learning Platform

University-lab workspace for learning DSA with **real Python tracing** and **teaching agents** that hint instead of dumping solutions.

## Curriculum

**Phase I — Linear structures**
- Arrays, Two Pointers, Sliding Window, Linked Lists

**Phase II — Trees, Graphs & DP**
- Trees, Graphs, Dynamic Programming

Flow for every topic:
0. Learn (notes + traced demo + quiz unlock)  
1. See the problem  
2. Predict steps  
3. Code and trace  
4. Test edge cases + viva  

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

## Content

20 problems across 7 topics (3 each except graphs with 2). Solutions stay server-side.

## Product shape

- **Per-topic adaptive path** — Diagnose prerequisites → Plan Agent soft path → Teach Agent overview → practice  
- **Problems list** — NeetCode-style roadmap checklist (soft plan badges; nothing hard-locked)  
- **Workspace** — LeetCode-style split: description | editor | Run/Submit | testcases  
- **Agents dock** — Hint / Demo / Predict / Debug / Viva (+ Diagnostic / Plan / Teach on topic pages)

## Demo path

1. Open http://127.0.0.1:3417 → **Diagnose** on a topic (or open any problem immediately)  
2. Answer the short prereq check → soft custom plan  
3. Teach Agent overview → recommended problem  
4. In the workspace: See → Predict → Code → Submit → Viva + Agents dock  
5. **/progress** + **Reset session** for evaluator demos  

## Tests

```bash
cd apps/api && uv run pytest tests/test_platform_smoke.py -q
```

## Repo layout

```
apps/web/       Next.js UI
apps/api/       FastAPI + runner + agents
content/        Problems, notes, quizzes, roadmap
```
