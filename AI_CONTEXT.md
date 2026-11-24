# Pointer Lab — AI handoff context

**Copy this file (or sections of it) when briefing another AI.**  
Product UI name: **Pointer Lab** · Conceptual / FYP name: **MultiagentDSA** · Repo: monorepo `apps/web` + `apps/api` + `content/`

**Last updated:** after pilot UX polish (Two Pointers one-door path, stage rail, next-action banner, stage-aware agents).

---

## 1. What it is (one paragraph)

Pointer Lab is a university-lab DSA learning platform. Students do **not** get solution dumps. They walk a locked practice loop — **See → Predict → Code → Test → Viva** — with **real Python execution traces** and **five teaching agents** that hint without pasting full solutions. Curriculum is JSON/Markdown under `content/` (~**73 problems**, **9 topics**). Sessions are **guest-only** (`localStorage` session id); no full auth product yet.

---

## 2. Who it’s for / stakes

- FYP / lab demos and student pilots  
- Evaluators need a repeatable path + **Reset session** on `/progress`  
- Strategic focus (from product council): **prove one cold user can finish one full loop** on the **Two Pointers pilot** before adding more content or category features  

---

## 3. User journeys

### Pilot path (preferred entry)
1. Home → **Start Two Pointers** (or nav **Pilot**)  
2. Topic `/topics/two-pointers`: **Diagnose → Plan → Overview → Practice**  
3. Open recommended problem `/problems/[id]`  
4. Finish stages; viva unlocks **only on full test pass**  
5. `/progress` → Reset before next demo  

### Problem workspace stages (backend stage ints ≈ 1–4)
| UI stage | Meaning |
|----------|---------|
| See | Run brute-force demo + trace |
| Predict | Answer predict steps; unlocks editor |
| Code | Monaco Python; Run = demo check |
| Test | Submit examples + hidden; fail keeps viva locked |
| Viva | Rubric oral check → mastered |

### Agents (LangGraph in API)
| Id | UI label | Role |
|----|----------|------|
| `concept_tutor` | Hint | Pattern/invariant |
| `demo_coach` | Demo | Brute/demo trace |
| `predict_coach` | Predict | Next-state help |
| `code_mentor` | Debug | AST/errors/tests |
| `viva_agent` | Viva | Complexity / edges |

Post-reply **solution-leak guard** can regenerate once, then fall back to a safe hint. No LLM key → mock coaches.

---

## 4. Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15, React 19, TS, Tailwind, Monaco, React Flow · port **3417** |
| API | FastAPI, LangGraph, Chroma notes, SQLAlchemy/SQLite · port **8417** |
| Runner | `sys.settrace` sandbox (optional Docker) |
| LLM | Groq OpenAI-compatible by default (`GROQ_API_KEY` / `LLM_API_KEY`) |
| Content | `content/problems/*.json`, notes, diagnostics, roadmap |

Env for web: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8417`

---

## 5. Repo map

```
apps/web/src/app/page.tsx              Home (pilot hero)
apps/web/src/app/topics/[slug]/page.tsx Topic diagnose→practice
apps/web/src/app/problems/[id]/page.tsx Workspace
apps/web/src/app/progress/page.tsx     Mastery + reset
apps/web/src/components/workspace/     StageRail, AgentDock, VisualCanvas
apps/api/app/agents/                   coordinator, solution_guard, topic_pipeline
apps/api/app/runner/                   sandbox, viva_grade
content/problems/                      73 problem JSON files
MULTIAGENTDSA_CONTEXT.md               Longer technical context
README.md                              Run instructions
```

---

## 6. How it looks (visual language)

### Mood
Academic lab / modern workbench — calm teal-green on mint-gray, serif brand + sans UI. Not purple-SaaS, not cream-terracotta. Feels like a focused notebook, not a marketing site or dense IDE chrome on home.

### Palette (CSS variables in `apps/web/src/app/globals.css`)
| Token | Approx | Use |
|-------|--------|-----|
| `--bg` / `--bg-deep` | `#eef3f1` → `#dde7e3` | Page wash |
| `--ink` | `#14201c` | Primary text |
| `--muted` | `#4d5c56` | Secondary text |
| `--accent` | `#0b6e5f` | CTAs, active stages, links |
| `--accent-2` | `#1d4e89` | Secondary accent / Demo coach |
| `--line` | soft dark green @ 12% | Borders |
| Soft radials | teal + blue blobs | Atmosphere behind grid |

Background: soft radial gradients + faint **grid-fade** overlay (blueprint feel). Panels: frosted white (`backdrop-filter`), light shadow, ~12px radius — not heavy card stacks in the hero.

### Typography
- **Display / brand / H1–H3:** Fraunces (serif), tight tracking — “Pointer Lab”, topic titles  
- **UI / body:** Manrope  
- **Code:** IBM Plex Mono (editor + examples)

### Layout by screen

**Chrome (all pages)**  
Top bar: frosted white, logo **Pointer Lab** + “Guest lab”, nav **Home · Pilot · Progress**. Pilot is tinted teal chip.

**Home `/`**  
1. Eyebrow “Guest practice lab”  
2. Large serif **Pointer Lab** + one sentence about the locked loop  
3. Dominant **Start here / Two Pointers pilot** panel (gradient white→teal wash): 5 mini steps Diagnose…Viva, primary teal **Start Two Pointers**, session mastery count  
4. Below fold: “How a problem works” 5-stage strip, optional React Flow learning graph, pattern filters, collapsible topic lists (Two Pointers marked Pilot)

**Topic `/topics/[slug]`**  
Narrow centered column (~`max-w-3xl`). Step tabs Diagnose / Plan / Overview / Practice. White/glass panels for MCQ diagnostic, soft plan + “Before you code” micro-reviews, overview markdown, problem list with Recommended CTA.

**Problem workspace `/problems/[id]`** (full height under nav)  
- Top: back link, title, difficulty chip, **stage rail** See|Predict|Code|Test|Viva  
- **Next · {stage}** banner (teal / amber / emerald by state) + CTA (Run demo / Go to predict / Focus editor / Open viva)  
- **3 columns (lg+):**  
  - Left white: Description | **Learn path** | Visual tabs (Learn path default while editor locked)  
  - Center dark: Monaco + Run/Submit + testcase console; lock overlay until Predict done  
  - Right dark: **AgentDock** with colored coach skins; stage-suggested agent outlined  
- Mobile: Agents drawer  

**Progress**  
Simple mastery list + **Reset session** for demos.

### Motion
Light `rise` entrance on key blocks; soft pulse on the next-action CTA. Prefer calm hierarchy over flashy effects.

### Screenshots (local artifacts from a live run)
- Home hero: `/opt/cursor/artifacts/pointer-lab-home.webp`  
- Topic diagnose: `/opt/cursor/artifacts/pointer-lab-topic.webp`  
- Workspace (locked editor + stage rail + agents): `/opt/cursor/artifacts/pointer-lab-workspace.webp`  

---

## 7. Product rules another AI must respect

1. **Do not expand curriculum** as the default next move — polish the pilot loop.  
2. **One entry door** for demos: Two Pointers → diagnose/plan/overview → recommended problem.  
3. Agents **must not** dump full solutions; guard exists — keep it.  
4. **Viva only after full test pass**; failed submit must not look “done.”  
5. Guest session only unless explicitly asked to add auth.  
6. Preserve visual language (teal/mint, Fraunces+Manrope) unless redesign is requested.  
7. Prefer editing existing surfaces over adding new top-level nav/pages.

---

## 8. Quick run

```bash
# API
cd apps/api && uv sync && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8417

# Web
cd apps/web && npm install && NEXT_PUBLIC_API_URL=http://127.0.0.1:8417 npm run dev
```

```bash
cd apps/api && uv run pytest -q
```
