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

- **Problems list** — NeetCode-style roadmap checklist (topic sections, difficulty, mastery)  
- **Workspace** — LeetCode-style split: description | editor | Run/Submit | testcases  
- **Agents dock** — switchable Hint / Demo / Predict / Debug / Viva (LangGraph + Groq)

## Demo path

1. Open http://127.0.0.1:3417 → pick a problem from the checklist  
2. Topic **Lesson** unlocks coding (Stage 0 quiz)  
3. Learn path: See → Predict → Code → Submit → Viva  
4. Use the **Agents** tab while coding for targeted help  
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
