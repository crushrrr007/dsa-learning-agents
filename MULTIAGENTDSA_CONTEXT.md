# MultiagentDSA — Project Context Document

**Working product name in UI/README:** Pointer Lab  
**Repo package name:** `dsa-multi-agent-platform`  
**Code location:** monorepo with `apps/web`, `apps/api`, and `content/`  
**Purpose of this document:** Give another AI assistant accurate, codebase-grounded context for product and technical decisions.  
**Last verified against:** repository state after pattern-graph / KG / skinned-agents work.

> Naming note: The product is branded **Pointer Lab** in the app and README. **MultiagentDSA** is the conceptual / FYP name for the same codebase.

---

## 1. What is MultiagentDSA?

### Problem it solves
Students learning Data Structures & Algorithms often jump straight to solution dumps (LeetCode/NeetCode writeups). This platform instead forces a **learn-by-doing loop**: diagnose readiness, get a soft personalized plan, study a short overview, then practice in a LeetCode-like editor with **real Python execution traces** and **teaching agents that are instructed never to paste full solutions**.

### Who it is for
- University / lab / final-year project demos (guest session; no full auth product)
- Students practicing linear structures through trees, graphs, and DP
- Evaluators who need a repeatable demo path and a **Reset session** button

### Main idea
Combine three layers:

1. **Curriculum as data** (`content/`) — problems, notes, quizzes, diagnostics, roadmap  
2. **Multi-agent teaching** — LangGraph-routed coaches in the workspace + a topic-level diagnostic/plan/teach pipeline  
3. **Grounded execution** — student code runs in a sandbox with `sys.settrace`; UI visualizes frames; agents receive AST/runner facts, not secret solutions

### What a user actually does
1. Opens **home** (`/`) — sees a React Flow **topic → pattern** graph, pattern filter chips, and topic/problem lists (no Phase I/II chrome in the live UI).  
2. Opens a **topic** (`/topics/[slug]`) — **Diagnose** → **soft Plan** (with “Before you code” micro-reviews) → **Teach overview** → **Practice**.  
3. Opens a **problem** (`/problems/[id]`) — Description / Learn path / Visual | Monaco editor + Run/Submit + testcases | persistent **AgentDock** (Hint/Demo/Predict/Debug/Viva).  
4. Advances stages: See (brute demo) → Predict → Code → Submit tests → Viva → mastery.  
5. Checks **/progress** and can **Reset session** (clears progress, plans, attempts, and session KG edges).

Session identity is a browser `localStorage` id (`dsa_session_id` via `getSessionId()` in `apps/web/src/lib/utils.ts`), sent as `session_id` to the API (default `"guest"`).

---

## 2. Current Features

### Implemented and used by the primary UI

| Feature | How it works | Key code |
|--------|----------------|----------|
| Visual pattern roadmap | Home loads `GET /topics/roadmap/graph` and renders React Flow nodes/edges; click topic → topic page; click pattern → `/?pattern=` | `RoadmapGraph.tsx`, `kg_service.build_roadmap_graph` |
| Pattern explore | `GET /problems/patterns`; filter `GET /problems?pattern=`; chips on home/topic | `content_loader.list_patterns`, `slugify_pattern` |
| Per-topic diagnostic | 3–5 questions from `content/diagnostics/{topic}.json`; scored MCQs + comfort/goal | `topics.submit_diagnostic`, `topic_pipeline.interpret_diagnostic` |
| Soft learning plan | Ordered review_first / recommended / optional problems; never hard-locks | `topic_pipeline.build_soft_plan` |
| Micro-reviews | Weak skills → “Before you code” cards | `build_micro_reviews`, topic page UI |
| Teach overview | Notes + optional LLM polish | `teach_overview`, `GET/POST .../overview` |
| Soft unlock | Problems openable without finishing lesson/quiz; stage at least 1 | `problems.problem_detail` |
| Problem workspace | Split panes; stages See/Predict/Code/Test/Viva | `apps/web/src/app/problems/[id]/page.tsx` |
| Monaco coding | Student Python; editor locked until predict stage ≥ 3 | same page |
| Live tracing | `/run` returns events; `VisualCanvas` draws array/window/list/tree/graph/dp | `sandbox.run_student_code`, `VisualCanvas.tsx` |
| Predict checks | Flexible answer matching + optional trace support | `POST /predict`, `trace_check.py` |
| Hidden tests + viva | `/test` runs edge cases; `/viva` marks mastered | `routers/run.py` |
| Teaching AgentDock | Five skinned agents; `preferred_agent` routing | `AgentDock.tsx`, `coordinator.run_coordinator` |
| Progress + reset | Snapshot + delete session data including KG session edges | `progress_service.reset_session_progress` |
| SQLite knowledge graph | Curriculum seed + session weak/recommended/mastered/attempted edges | `models.KgNode/KgEdge`, `kg_service.py` |
| Solution privacy | `public_problem()` strips `reference_solution` / hidden tests | `content_loader.public_problem` |
| LLM optional | Groq OpenAI-compatible by default; mock coaches without key | `llm.resolve_llm_config`, `chat_complete` |

### Implemented in API/content but **not** driven by the primary topic UI

| Feature | Status |
|--------|--------|
| Stage-0 notes + quiz unlock (`GET /topics/{slug}/learn`, `POST /topics/quiz`, `POST /topics/{slug}/demo`) | **Still in API and content**; client helpers exist in `api.ts` (`fetchTopicLearn`, `submitQuiz`, `runTopicDemo`) but **topic page no longer uses them**. Primary path is diagnostic/plan/overview. |
| `content/quizzes/*.json`, notes markdown | Present; notes still feed Chroma/`retrieve_notes` and teach overview. |
| Roadmap `phases` in `content/topics/roadmap.json` | Still in JSON; **API `GET /topics/roadmap` returns `phases: []`** for product UI. |

### Incomplete / partial / orphaned

| Item | Detail |
|------|--------|
| Docker runner | Code in `docker_runner.py`; only used if `DSA_USE_DOCKER=1` (or similar) and Docker CLI present. Default is **subprocess** sandbox. `Settings.runner_backend` is not what selects Docker. |
| `StageRail.tsx` | Component exists; **not imported** by problem page (inline stage chips used instead). |
| LangGraph coverage of diagnostic/plan/teach | Those agents are **pipeline functions**, not LangGraph nodes (see §4). |
| Viva grading | Lenient: ≥2 answers, each ≥8 characters → mastered (`submit_viva`). |
| `/test` stage bump | Sets stage to 4 even when tests fail. |
| Graph topic content | Only **2** graph problems vs 3 for most topics. |
| Auth / multi-device accounts | Not implemented; guest session only. |
| True Neo4j KG | Not used; SQLite tables emulate a knowledge graph. |

---

## 3. Technology Stack

### Frontend (`apps/web`)
- **Next.js 15** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS**
- **Monaco Editor** (`@monaco-editor/react`)
- **React Flow** (`reactflow`) — roadmap graph + trace canvas layouts
- **lucide-react** icons
- Dev server port **3417**; `NEXT_PUBLIC_API_URL` → API (default `http://127.0.0.1:8417`)

### Backend (`apps/api`)
- **FastAPI** + **Uvicorn**
- **SQLAlchemy 2** async + **aiosqlite** → `apps/api/data/dsa.db`
- **Pydantic Settings** (`app/config.py`)
- **LangGraph** (`langgraph.graph.StateGraph`) for workspace agent routing
- **ChromaDB** for topic notes retrieval (`agents/notes_store.py`)
- **OpenAI Python SDK** against OpenAI-compatible APIs (Groq default)
- Package managed with **uv** (`pyproject.toml`)
- API port **8417**

### AI models / providers
- Default: **Groq** `https://api.groq.com/openai/v1`, model setting `openai/gpt-oss-20b` (overridable via `LLM_MODEL`)
- Env keys: `LLM_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` (and settings fields)
- Classic OpenAI `sk-` keys without Groq config fall back to OpenAI host + `gpt-4o-mini`
- **No key → mock** deterministic replies (`mock_agent_reply`)

### Agent frameworks
- **LangGraph** for five workspace agents (`coordinator.py`)
- Topic path agents are **plain async Python** in `topic_pipeline.py` (not a second StateGraph)

### Other integrations
- Optional **Docker** isolation for student code
- Content files JSON/Markdown under `content/`
- Smoke tests: `apps/api/tests/test_platform_smoke.py` (pytest)

---

## 4. Multi-Agent System

### A. Workspace teaching agents (LangGraph)

**File:** `apps/api/app/agents/coordinator.py`  
**Entry:** `run_coordinator(...)` ← `POST /agents/chat` (`routers/agents.py`)  
**UI:** `AgentDock` sends `preferred_agent`, `stage`, `code`, `last_run`

| Agent id | UI label | Responsibility |
|----------|----------|----------------|
| `concept_tutor` | Hint | Pattern/invariant from notes; no full code |
| `demo_coach` | Demo | Narrate demo/brute traces |
| `predict_coach` | Predict | Help predict next state |
| `code_mentor` | Debug | AST/errors/tests grounded hints |
| `viva_agent` | Viva | Complexity / edge-case probes |

**Orchestration:**
1. `route_node` → `choose_agent` (preferred agent, phrase heuristics, or stage map) + `retrieve_notes`
2. Conditional edge to one of five nodes
3. Each node → `_reply_for` → `chat_complete` with `NO_SOLUTION_POLICY` + topic/stage hints + `summarize_facts(last_run)`; on failure/absence → `mock_agent_reply`
4. Returns `{ agent, agent_label, reply, guiding_question }` (plus `llm_mode` from router)

**State:** LangGraph `AgentState` TypedDict (stage, topic, message, code, facts, notes, route, reply…). Not a long-term conversation store — UI keeps chat history in React state per agent switch (switching agent resets local message list in `AgentDock`).

**Outputs:** Single agent reply per request; no multi-agent debate or merge step.

### B. Topic pipeline agents (non-LangGraph)

**File:** `apps/api/app/agents/topic_pipeline.py`

| Conceptual agent | Function(s) | Responsibility |
|------------------|-------------|----------------|
| Diagnostic | `interpret_diagnostic`, `_score_mcq` | Score MCQs; comfort/goal flags |
| Plan | `build_soft_plan`, `enrich_plan_with_llm`, `build_micro_reviews` | Soft ordered plan + micro-reviews; optional KG signals |
| Teach | `teach_overview` | Short overview from notes ± LLM |

**Orchestrator:** `run_diagnostic_to_plan(topic, answers, session_id=, db=)` then persist via `upsert_topic_plan` and `record_diagnostic_kg`.

Role strings for these three also appear in `AGENT_ROLES` / `GET /agents/status`, but they are **not** nodes in the LangGraph.

### C. How context is maintained
- **Per session SQLite:** Progress, TopicProgress, TopicPlan, Attempt, KgEdge(session_id=…)
- **Curriculum KG:** seeded nodes/edges (`session_id=""`) at API startup (`seed_curriculum_graph` in `main` lifespan)
- **Notes:** Chroma collection `dsa_notes` or markdown fallback
- **No cross-user persistence** beyond whoever shares the same `session_id`

### D. Policy
`NO_SOLUTION_POLICY` in `llm.py`: never provide complete working solutions; teach with hints/questions; ground in trace/AST facts when available.

---

## 5. Architecture

### High-level

```
Browser (Next.js :3417)
  ├─ /                RoadmapGraph + patterns + topics
  ├─ /topics/[slug]   Diagnostic → Plan → Overview → Practice
  ├─ /problems/[id]   Workspace + AgentDock
  └─ /progress        Mastery + Reset
           │
           ▼  HTTP JSON (session_id)
FastAPI (:8417)
  ├─ topics / problems / run / agents / progress
  ├─ agents/coordinator.py   (LangGraph)
  ├─ agents/topic_pipeline.py
  ├─ kg_service.py
  ├─ progress_service.py
  ├─ content_loader.py  ← content/
  └─ runner/sandbox.py  ← settrace (± Docker)
           │
           ▼
SQLite (dsa.db) + Chroma (data/chroma/)
```

### Important directories
- `content/` — curriculum source of truth  
- `apps/api/app/routers/` — HTTP surface  
- `apps/api/app/agents/` — LLM + orchestration  
- `apps/api/app/runner/` — execution  
- `apps/web/src/app/` — pages  
- `apps/web/src/components/workspace/` — AgentDock, VisualCanvas  
- `apps/web/src/components/roadmap/` — RoadmapGraph  

### Database structure (implemented)
- `progress` — per problem stage/mastery/last_code  
- `topic_progress` — learn_completed / quiz_score (legacy learn path)  
- `topic_plans` — diagnostic_answers + plan_json + overview_completed  
- `attempts` — attempt log  
- `kg_nodes` / `kg_edges` — curriculum + personalized graph  

### Typical user → agent execution flow
1. User asks Hint in AgentDock.  
2. `chatAgent` → `POST /agents/chat` with `preferred_agent=concept_tutor`, stage, code, last_run.  
3. `run_coordinator` → LangGraph routes to `concept_tutor` → notes + LLM/mock → reply.  
4. Separately, topic diagnostic → `run_diagnostic_to_plan` → SQLite plan + KG edges → home graph styles update on next `GET /topics/roadmap/graph`.

### Code run flow
1. `POST /run` or `/test` with student code.  
2. `run_student_code` → Docker if enabled else subprocess worker with `sys.settrace`.  
3. Events + AST insights returned; attempts/KG edges recorded for student runs / mastery.

---

## 6. Current Development Status

### Working (demo-ready)
- End-to-end path: home graph → topic diagnose/plan/overview → problem workspace → agents → progress/reset  
- Soft plans + micro-reviews + pattern filters  
- Groq or mock LLM  
- Subprocess tracing + visualizations for major visual types  
- API smoke tests (`test_platform_smoke.py`) covering health, roadmap, patterns, graph, diagnostic, soft unlock, agents, runner samples  

### Incomplete / uneven
- Stage-0 learn+quiz UI superseded but APIs/content remain (dual narrative vs README “Learn” bullet)  
- Docker runner off by default / env-gated  
- Graphs under-contented (2 problems)  
- Agent chat is single-turn orchestration (no durable multi-turn memory server-side)  
- KG is useful but lightweight (not a full reasoning graph DB)  

### Known limitations / bugs-of-design
- Editor locked until Predict completes (intentional learning gate; less pure LeetCode)  
- Viva acceptance is shallow string-length check  
- Failed `/test` still advances stored stage to 4  
- Switching AgentDock tabs clears local chat thread  
- README still mentions Phase I/II curriculum and old Learn→… flow while product UI emphasizes pattern graph + diagnose path  

### Technical debt
- Unused `StageRail.tsx`  
- Unused client wrappers for learn/quiz/demo  
- `Settings.runner_backend` vs env-based Docker detection inconsistency  
- Phase fields still in content/schemas while API empties phases for UI  
- Minimal shadcn surface (mostly custom + one Button)  

### Improvement areas (product/tech)
- Reconcile README vs live topic flow; either restore Learn UI or retire dead APIs  
- Stronger KG → agent grounding (pass `session_signals` into workspace chat)  
- More problems per thin topics; richer pattern metadata  
- Durable agent conversation store; better viva rubrics  
- Accounts if multi-device FYP demos are required  

---

## 7. Product Vision

### Current aim
A **university-demoable multi-agent DSA lab** that looks like a modern coding platform (NeetCode/LeetCode cues) but teaches via **staged practice, real traces, and hint-only agents**, with **personalization** from diagnostics and a SQLite knowledge graph.

### Strongest capabilities today
1. Real execution tracing + visual canvas (not fake animations only)  
2. Coherent multi-agent teaching surface (skinned AgentDock + no-solution policy)  
3. Soft adaptive topic entry (diagnostic → plan → teach) without hard locking  
4. Pattern-centric roadmap graph tied to session history  
5. Evaluator-friendly reset and documented Two Pointers demo script  

### Opportunities for future development
- Deeper personalization (global intake, spaced repetition, skill mastery curves)  
- Heavier agent tooling (test-failure tools, structured critique, multi-agent critique panels)  
- Content expansion (graphs/DP density, more patterns)  
- Production hardening (auth, Docker-default sandbox, hosted publish of API+web together)  
- Assessment quality (rubriced viva, plagiarism-resistant mastery checks)  
- True graph DB or exported KG analytics for research/FYP writeups  

---

## Quick reference: key symbols

| Symbol | Location |
|--------|----------|
| `run_coordinator` | `apps/api/app/agents/coordinator.py` |
| `run_diagnostic_to_plan` | `apps/api/app/agents/topic_pipeline.py` |
| `chat_complete` / `AGENT_ROLES` | `apps/api/app/agents/llm.py` |
| `build_roadmap_graph` | `apps/api/app/kg_service.py` |
| `run_student_code` | `apps/api/app/runner/sandbox.py` |
| `AgentDock` | `apps/web/src/components/workspace/AgentDock.tsx` |
| `RoadmapGraph` | `apps/web/src/components/roadmap/RoadmapGraph.tsx` |
| `getSessionId` | `apps/web/src/lib/utils.ts` |

---

## How another AI should use this document

- Treat **Pointer Lab UI + MultiagentDSA concept** as the same product.  
- Prefer **code paths listed here** over README alone when they disagree.  
- Do **not** assume Stage-0 quiz unlock is the live topic UX unless restoring that UI.  
- Do **not** assume Neo4j, Docker-by-default, or user accounts exist.  
- When proposing features, extend `content/`, `topic_pipeline` / `coordinator`, `kg_service`, or the Next.js pages above rather than inventing a parallel stack.

---

*Generated for brainstorming and development handoff. Inspect the repo again before large architectural changes.*
