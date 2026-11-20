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

Optional LLM:

```bash
export OPENAI_API_KEY=sk-...
```

Optional Docker runner (subprocess is default):

```bash
export DSA_USE_DOCKER=1
export DSA_DOCKER_IMAGE=python:3.12-slim
```

## Demo path

1. Open http://127.0.0.1:3417  
2. Phase I → **Two Pointers** → concept demo + quiz  
3. Complete **Valid Palindrome** through all stages  
4. Phase II → **Trees** / **Graphs** / **DP** similarly  
5. Check **/progress** for mastery  

## Repo layout

```
apps/web/       Next.js UI
apps/api/       FastAPI + runner + agents
content/        Problems, notes, quizzes, roadmap
```
