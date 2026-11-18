# Pointer Lab — Multi-Agent DSA Learning Platform (Phase I)

University-lab workspace for learning **Arrays**, **Two Pointers**, **Sliding Window**, and **Linked Lists**.

Students learn the concept first, then move through a four-stage loop:

1. **See the problem** — run a slow demo and watch it struggle  
2. **Predict the steps** — answer prompts checked against real traces  
3. **Code and trace** — write logic in Monaco and watch pointers move  
4. **Test edge cases** — generated checks + viva questions on *your* code  

Teaching agents (Coordinator, Concept Tutor, Feedback Agent) explain facts from `sys.settrace` / AST analysis. They are prompted **not** to dump full solutions.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, TypeScript, Tailwind, Monaco, React Flow |
| Backend | FastAPI, LangGraph-style coordinator, ChromaDB notes |
| Runner | Sandboxed Python subprocess + `sys.settrace` + `ast` |
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

Optional LLM (otherwise deterministic mock tutors run):

```bash
export OPENAI_API_KEY=sk-...
```

## Demo path

1. Open http://127.0.0.1:3417  
2. Choose **Two Pointers** → complete the 3-question concept check  
3. Open **Valid Palindrome** or **Two Sum in Sorted Array**  
4. Walk stages See → Predict → Code/Trace → Test/Viva  

## Repo layout

```
apps/web/       Next.js UI
apps/api/       FastAPI + runner + agents
content/        Problem bank + topic notes (solutions stay server-side)
```

## Phase II (out of scope here)

Trees, graphs, dynamic programming, accounts/OAuth, contest leaderboards.
