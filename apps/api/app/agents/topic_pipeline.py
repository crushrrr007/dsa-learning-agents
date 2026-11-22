"""Per-topic diagnostic → plan → teach pipeline (soft guidance)."""

from __future__ import annotations

import json
from typing import Any

from app.agents.llm import TOPIC_HINTS, chat_complete
from app.agents.notes_store import retrieve_notes
from app.content_loader import list_problems, load_diagnostic, load_notes

# Static micro-reviews keyed by diagnostic skill ids (+ a few prereq aliases)
SKILL_MICRO_REVIEWS: dict[str, dict[str, str]] = {
    "indexing": {
        "title": "Array indexing",
        "blurb": "Valid indices run from 0 to n-1. Off-by-one bugs usually mean you used n or forgot the empty case.",
        "prereq_topic": "arrays",
    },
    "in-place": {
        "title": "In-place updates",
        "blurb": "Change values in the same array when you can; track what must stay true after each swap or write.",
        "prereq_topic": "arrays",
    },
    "opposite-ends": {
        "title": "Opposite-end pointers",
        "blurb": "Start left at 0 and right at n-1. Move the pointer that improves the comparison toward the middle.",
        "prereq_topic": "arrays",
    },
    "pointer-move": {
        "title": "Which pointer moves?",
        "blurb": "After each comparison, ask which index must advance so the search space shrinks and you never stall.",
        "prereq_topic": "two-pointers",
    },
    "fixed-window": {
        "title": "Fixed window length",
        "blurb": "Keep window size k constant: expand right, then drop the left element when the window grows past k.",
        "prereq_topic": "arrays",
    },
    "variable-window": {
        "title": "When to shrink",
        "blurb": "Grow right while valid; when the window breaks a constraint, advance left until it is valid again.",
        "prereq_topic": "two-pointers",
    },
    "rewire": {
        "title": "Save next before rewiring",
        "blurb": "Before changing node.next, keep a reference to the old next (or you lose the rest of the list).",
        "prereq_topic": "linked-lists",
    },
    "cycle": {
        "title": "Fast and slow pointers",
        "blurb": "Slow moves one step, fast two. If they meet, a cycle exists; null checks prevent crashes on open lists.",
        "prereq_topic": "linked-lists",
    },
    "base-case": {
        "title": "Tree null base case",
        "blurb": "Recursion bottoms out when node is None. Decide what empty subtree returns before combining children.",
        "prereq_topic": "trees",
    },
    "combine": {
        "title": "Combine left and right",
        "blurb": "Solve left and right first, then combine at the current node (depth, equality, invert, etc.).",
        "prereq_topic": "trees",
    },
    "visited": {
        "title": "Mark visited",
        "blurb": "In undirected graphs, mark a node visited when you first see it so BFS/DFS cannot loop forever.",
        "prereq_topic": "graphs",
    },
    "bfs": {
        "title": "BFS layers",
        "blurb": "BFS explores level by level with a queue — that is why it finds shortest paths in unweighted graphs.",
        "prereq_topic": "graphs",
    },
    "state": {
        "title": "One DP cell, one subproblem",
        "blurb": "Name what dp[i] means in one sentence. If you cannot, the transition will stay fuzzy.",
        "prereq_topic": "dynamic-programming",
    },
    "order": {
        "title": "Fill order matters",
        "blurb": "Bottom-up DP fills smaller subproblems first so every transition reads answers that already exist.",
        "prereq_topic": "dynamic-programming",
    },
}

# When a topic lists prerequisites as prose, map rough keywords → roadmap slugs
PREREQ_TOPIC_HINTS: dict[str, str] = {
    "arrays": "arrays",
    "two-pointers": "two-pointers",
    "two pointers": "two-pointers",
    "indexing": "arrays",
    "recursion": "trees",
    "linked-lists": "linked-lists",
    "queues": "graphs",
    "stacks": "graphs",
    "trees": "trees",
}


def build_micro_reviews(topic: str, analysis: dict[str, Any]) -> list[dict[str, str]]:
    """Turn weak skills + prereq strings into short Before-you-code cards."""
    reviews: list[dict[str, str]] = []
    seen: set[str] = set()

    for skill in analysis.get("skills_weak") or []:
        meta = SKILL_MICRO_REVIEWS.get(skill)
        if not meta or skill in seen:
            continue
        seen.add(skill)
        reviews.append(
            {
                "skill": skill,
                "title": meta["title"],
                "blurb": meta["blurb"],
                "prereq_topic": meta.get("prereq_topic") or "",
                "notes_anchor": meta["title"],
            }
        )

    # Low comfort: add a gentle topic-level card even if MCQs somehow all passed
    if analysis.get("low_comfort") and topic not in seen:
        hint = TOPIC_HINTS.get(topic, "Focus on the core invariant for this pattern.")
        reviews.insert(
            0,
            {
                "skill": f"{topic}-comfort",
                "title": f"{topic.replace('-', ' ').title()} warm-up",
                "blurb": f"Take an easier first problem. {hint}",
                "prereq_topic": "",
                "notes_anchor": "",
            },
        )
        seen.add(topic)

    for raw in analysis.get("prerequisites") or []:
        key = str(raw).lower()
        slug = None
        for needle, mapped in PREREQ_TOPIC_HINTS.items():
            if needle in key:
                slug = mapped
                break
        if not slug or slug == topic or slug in seen:
            continue
        # Only add prereq topic card if we already have weak skills / low comfort
        if not (analysis.get("skills_weak") or analysis.get("low_comfort")):
            continue
        seen.add(slug)
        reviews.append(
            {
                "skill": f"prereq-{slug}",
                "title": f"Review: {slug.replace('-', ' ').title()}",
                "blurb": f"This topic builds on {slug.replace('-', ' ')}. Skim that lesson if the first problem feels stuck.",
                "prereq_topic": slug,
                "notes_anchor": "",
            }
        )

    return reviews[:5]


def _score_mcq(topic: str, answers: dict[str, Any]) -> dict[str, Any]:
    diag = load_diagnostic(topic)
    skills_ok: list[str] = []
    skills_weak: list[str] = []
    for q in diag.get("questions", []):
        qid = q["id"]
        if q.get("type") != "mcq" or "answer_index" not in q:
            continue
        skill = q.get("skill") or qid
        chosen = answers.get(qid)
        try:
            chosen_i = int(chosen)
        except (TypeError, ValueError):
            skills_weak.append(skill)
            continue
        if chosen_i == q["answer_index"]:
            skills_ok.append(skill)
        else:
            skills_weak.append(skill)
    return {"skills_ok": skills_ok, "skills_weak": skills_weak}


def interpret_diagnostic(topic: str, answers: dict[str, Any]) -> dict[str, Any]:
    """Diagnostic agent: flag missing prereqs / comfort from answers."""
    scored = _score_mcq(topic, answers)
    comfort = str(answers.get("comfort") or answers.get("arrays_prereq") or answers.get("tp_prereq") or answers.get("refs") or answers.get("recursion") or answers.get("traversal") or answers.get("overlap") or "")
    goal = str(answers.get("goal") or "")
    low_comfort = any(w in comfort.lower() for w in ("never", "weak", "new", "refresher"))
    ambitious = any(w in goal.lower() for w in ("harder", "challenge", "jump", "medium"))
    summary = (
        f"Topic `{topic}`: weak skills={scored['skills_weak'] or ['none']}; "
        f"ok skills={scored['skills_ok'] or ['none']}; comfort={comfort or 'n/a'}; goal={goal or 'n/a'}."
    )
    return {
        **scored,
        "comfort": comfort,
        "goal": goal,
        "low_comfort": low_comfort,
        "ambitious": ambitious,
        "summary": summary,
        "prerequisites": load_diagnostic(topic).get("prerequisites", []),
    }


def build_soft_plan(
    topic: str,
    answers: dict[str, Any],
    analysis: dict[str, Any] | None = None,
    kg_signals: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Plan agent: ordered recommendations — soft, never locks."""
    analysis = analysis or interpret_diagnostic(topic, answers)
    kg_signals = kg_signals or {}
    # Merge historical weak skills from KG into this diagnostic view
    hist_weak = list(kg_signals.get("weak_skills") or [])
    if hist_weak:
        merged = list(dict.fromkeys([*(analysis.get("skills_weak") or []), *hist_weak]))
        analysis = {**analysis, "skills_weak": merged}
        if not analysis.get("low_comfort") and hist_weak:
            analysis = {**analysis, "low_comfort": True}

    problems = list_problems(topic)
    mastered = set(kg_signals.get("mastered_problems") or [])
    mastered_patterns = set(kg_signals.get("mastered_patterns") or [])
    # Prefer unmastered; deprioritize mastered patterns
    problems = [p for p in problems if p["id"] not in mastered] or list_problems(topic)
    # Sort easy → medium → hard, then title; bump weak-pattern problems slightly earlier
    weak_patterns = set(kg_signals.get("weak_patterns") or [])
    order_diff = {"easy": 0, "medium": 1, "hard": 2}

    def sort_key(p: dict[str, Any]):
        weak_boost = -1 if p.get("pattern_id") in weak_patterns else 0
        mastered_pat = 2 if p.get("pattern_id") in mastered_patterns else 0
        return (weak_boost + mastered_pat, order_diff.get(str(p.get("difficulty", "")).lower(), 9), p["title"])

    problems = sorted(problems, key=sort_key)

    recommended: list[dict[str, str]] = []
    review_first: list[dict[str, str]] = []
    optional: list[dict[str, str]] = []

    micro_reviews = build_micro_reviews(topic, analysis)

    if not problems:
        return {
            "topic": topic,
            "summary": "No problems in catalog yet.",
            "review_notes": analysis["summary"],
            "recommended": [],
            "review_first": [],
            "optional": [],
            "next_problem_id": None,
            "emphasis": "overview",
            "micro_reviews": micro_reviews,
        }

    if analysis.get("low_comfort") or analysis.get("skills_weak"):
        # Emphasize easiest first; mark later as optional
        for i, p in enumerate(problems):
            item = {"id": p["id"], "title": p["title"], "difficulty": p["difficulty"], "badge": "recommended"}
            if i == 0:
                item["badge"] = "review_first"
                review_first.append(item)
            elif i < max(1, len(problems) - 1):
                recommended.append({**item, "badge": "recommended"})
            else:
                optional.append({**item, "badge": "optional"})
        emphasis = "fundamentals"
        review_notes = (
            "Start gentle: shore up prerequisites, then take the easiest problem first. "
            f"Watch: {', '.join(analysis.get('skills_weak') or ['basics'])}."
        )
    elif analysis.get("ambitious"):
        for i, p in enumerate(problems):
            item = {"id": p["id"], "title": p["title"], "difficulty": p["difficulty"], "badge": "recommended"}
            if i == 0:
                optional.append({**item, "badge": "optional"})
            else:
                recommended.append(item)
        if not recommended and problems:
            recommended = [
                {
                    "id": problems[-1]["id"],
                    "title": problems[-1]["title"],
                    "difficulty": problems[-1]["difficulty"],
                    "badge": "recommended",
                }
            ]
        emphasis = "challenge"
        review_notes = "You asked for a challenge — mediums are prioritized; easier ones stay optional."
    else:
        for i, p in enumerate(problems):
            item = {"id": p["id"], "title": p["title"], "difficulty": p["difficulty"], "badge": "recommended"}
            if i == 0:
                recommended.append(item)
            elif i == len(problems) - 1 and len(problems) > 2:
                optional.append({**item, "badge": "optional"})
            else:
                recommended.append(item)
        emphasis = "balanced"
        review_notes = "Balanced path: quick overview, then work problems in difficulty order."

    next_id = None
    if review_first:
        next_id = review_first[0]["id"]
    elif recommended:
        next_id = recommended[0]["id"]
    elif optional:
        next_id = optional[0]["id"]

    plan = {
        "topic": topic,
        "summary": analysis.get("summary", ""),
        "review_notes": review_notes,
        "emphasis": emphasis,
        "prerequisites": analysis.get("prerequisites", []),
        "review_first": review_first,
        "recommended": recommended,
        "optional": optional,
        "next_problem_id": next_id,
        "micro_reviews": micro_reviews,
    }
    return plan


async def enrich_plan_with_llm(topic: str, plan: dict[str, Any]) -> dict[str, Any]:
    notes = retrieve_notes(topic, topic)[:1500]
    llm = await chat_complete(
        system=(
            f"You are the Plan Agent for DSA topic `{topic}`. "
            f"Topic hint: {TOPIC_HINTS.get(topic, '')} "
            "Rewrite review_notes as 2 short coaching sentences. Never dump solutions or code. "
            f"Notes excerpt:\n{notes}"
        ),
        user=json.dumps({"plan_summary": plan.get("summary"), "emphasis": plan.get("emphasis")}),
    )
    if llm and not llm.startswith("(LLM unavailable:"):
        plan = {**plan, "review_notes": llm.strip()[:500]}

    # Optional one-liner polish for the first micro-review blurb
    reviews = list(plan.get("micro_reviews") or [])
    if reviews:
        first = reviews[0]
        polished = await chat_complete(
            system=(
                "You are a DSA coach. Rewrite the micro-review blurb in one short sentence. "
                "No code, no full solutions."
            ),
            user=json.dumps({"title": first.get("title"), "blurb": first.get("blurb")}),
        )
        if polished and not polished.startswith("(LLM unavailable:"):
            reviews[0] = {**first, "blurb": polished.strip()[:240]}
            plan = {**plan, "micro_reviews": reviews}
    return plan


async def teach_overview(topic: str, plan: dict[str, Any] | None = None) -> dict[str, Any]:
    """Teach agent: brief overview from notes (+ optional LLM polish)."""
    raw_notes = load_notes(topic)
    retrieved = retrieve_notes(topic, f"overview {topic}")[:2000]
    base = retrieved or raw_notes[:2000]
    # Keep first ~ paragraphs for a brief overview
    lines = [ln for ln in base.splitlines() if ln.strip()]
    brief = "\n".join(lines[:18])
    llm = await chat_complete(
        system=(
            f"You are the Teach Agent for `{topic}`. "
            f"{TOPIC_HINTS.get(topic, '')} "
            "Write a brief topic overview (120-180 words) for a student about to practice. "
            "No full solutions, no complete code. End with one guiding question."
        ),
        user=f"Notes:\n{brief}\n\nPlan emphasis: {(plan or {}).get('emphasis', 'balanced')}",
    )
    if llm and not llm.startswith("(LLM unavailable:"):
        overview = llm.strip()
        guiding = "What invariant will you watch for in the first problem?"
        if "?" in overview:
            parts = overview.rsplit("?", 1)
            if len(parts) == 2 and len(parts[1]) < 40:
                guiding = (parts[0].split("\n")[-1] + "?").strip()
        return {
            "topic": topic,
            "overview_markdown": overview,
            "guiding_question": guiding,
            "source": "llm",
            "notes_excerpt": brief,
        }
    return {
        "topic": topic,
        "overview_markdown": brief,
        "guiding_question": "Can you state the core pattern for this topic in one sentence?",
        "source": "notes",
        "notes_excerpt": brief,
    }


async def run_diagnostic_to_plan(
    topic: str,
    answers: dict[str, Any],
    *,
    session_id: str | None = None,
    db: Any = None,
) -> dict[str, Any]:
    analysis = interpret_diagnostic(topic, answers)
    kg_signals: dict[str, Any] = {}
    if session_id and db is not None:
        try:
            from app.kg_service import session_signals

            kg_signals = await session_signals(db, session_id, topic)
        except Exception:
            kg_signals = {}
    plan = build_soft_plan(topic, answers, analysis, kg_signals=kg_signals)
    plan = await enrich_plan_with_llm(topic, plan)
    plan["diagnostic_analysis"] = analysis
    plan["kg_signals"] = kg_signals
    return plan
