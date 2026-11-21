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
- **Workspace** — description | editor + testcases | **persistent agents sidebar**  
- **Agents** — Hint / Demo / Predict / Debug / Viva always visible while coding; Diagnostic / Plan / Teach on topic pages  
- **Deeper plans** — diagnostic misses become **Before you code** micro-reviews (soft guidance only)

## Evaluator demo script (Two Pointers)

Reset first so the path is clean: open **/progress** → **Reset session** (clears plans + mastery).

1. Home → click **Demo this: Two Pointers** (or **Diagnose** on Two Pointers).  
2. Answer the prereq check (intentionally miss one MCQ to show micro-reviews) → **Build my soft plan**.  
3. Skim **Before you code** cards → **Continue to overview** → Teach Agent brief.  
4. **Start recommended problem** (usually an easy two-pointers item; **Valid Palindrome** is ideal if listed).  
5. Workspace: **See** → **Predict** → **Code** with the right-hand agents panel — try **Hint** then **Debug**.  
6. **Submit** → viva if prompted → **/progress** to show mastery → **Reset session** before the next evaluator.

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
