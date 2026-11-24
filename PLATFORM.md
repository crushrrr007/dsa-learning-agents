# Completing Pointer Lab (NeetCode × TYF × AlgoMaster × agents)

Pointer Lab is not a clone. Borrow the **navigation habits** people already know; keep our **multi-agent teaching loop** as the product.

## What each product contributes

| Habit from | Product job | Pointer Lab surface |
|------------|-------------|---------------------|
| **NeetCode** | Dense problem sheet → dark editor | `/problems`, `/problems/[id]` |
| **Take You Forward** | Ordered sheet + % progress + “continue” | `/sheets/pointer-lab-core`, topic diagnose→plan, Progress |
| **AlgoMaster** | Pattern-first mental model | `/patterns`, pattern chips, related problems |
| **Us** | Coaches that hint, never dump solutions | Demo / Predict / Code / Viva agents + leak guard + viva gate |

## Done in this slice (usable platform spine)

- Practice sheet with difficulty / status / topic / pattern filters
- Curated **Pointer Lab Core** sheet (22 problems) with completion bar
- Pattern explore page + related problems in workspace
- Workspace meta: difficulty, pattern chip, Python lab, stage rail, agent dock
- Guest session ID in the browser; plans, attempts, and progress in SQLite — no auth required for demos
- Visual tab with input previews, synchronized code and state, and contextual Demo Coach prompts
- Agentic topic timeline: Lesson → Diagnose → Plan → Teach → Practice

## Roadmap to “complete” (priority order)

### P0 — Demo-solid (keep green)

1. Pilot path: Two Pointers → Valid Palindrome → full See→…→Viva
2. Groq optional; heuristic fallback when key missing
3. No solution pastes (guard + UI copy)

### P1 — Sheet product parity

1. More curated sheets (e.g. “Blind 75 taste”, “Graphs week”) as JSON under `content/sheets/`
2. Sheet row filters on curated pages (difficulty/status)
3. “Next unsolved” CTA on home from active sheet progress
4. Optional video/notes link per problem (external URL only — we stay Socratic in-app)

### P2 — Pattern depth (AlgoMaster flavor)

1. Pattern detail page: when to use, traps, 3–5 starter problems (markdown under `content/patterns/`)
2. Cross-pattern “you might confuse this with…” from knowledge graph edges
3. Pattern mastery badge when all Core problems in pattern are mastered

### P3 — Topic tracks (TYF flavor)

1. Per-topic “A2Z-lite” ordered lists (already diagnose→plan; expand problem counts)
2. Spaced revisit of failed viva questions
3. Progress heatmap by topic/pattern

### P4 — Agent differentiation (our moat)

1. Stage-locked agent suggestions (already partly there) + stronger presence chips
2. Shared scratchpad / “what you already tried” memory across agents in one problem
3. Post-viva “teach-back” one-liner stored for Progress review
4. Optional voice/live coach for professor demos only

### P5 — Accounts & scale (only if asked)

1. Auth + synced progress (replace guest session)
2. Admin content CMS for sheets/problems
3. Multi-language starters (Python first forever for demos)

## Non-goals (stay different)

- Full solution videos / paid unlock walls
- Dumping complete code in chat
- Becoming a generic LeetCode mirror

## How to extend content

1. Add `content/problems/<id>.json` (statement, tests, predict, viva rubric)
2. Add id to `content/sheets/*.json` for curated lists
3. Pattern id is derived from `pattern` field — keep labels consistent
4. Restart API or hit content reload so caches clear

## Success criteria for “complete enough”

A new learner can: open **Sheet** or **Patterns** → pick a problem → finish the agent loop → see mastered on the sheet → continue related pattern problem — without leaving Pointer Lab or needing an account.
