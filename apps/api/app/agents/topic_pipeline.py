"""Per-topic diagnostic → plan → teach pipeline (soft guidance)."""

from __future__ import annotations

import json
from typing import Any

from app.agents.llm import TOPIC_HINTS, chat_complete
from app.agents.notes_store import retrieve_notes
from app.content_loader import list_problems, load_diagnostic, load_notes


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


def build_soft_plan(topic: str, answers: dict[str, Any], analysis: dict[str, Any] | None = None) -> dict[str, Any]:
    """Plan agent: ordered recommendations — soft, never locks."""
    analysis = analysis or interpret_diagnostic(topic, answers)
    problems = list_problems(topic)
    # Sort easy → medium → hard, then title
    order_diff = {"easy": 0, "medium": 1, "hard": 2}
    problems = sorted(problems, key=lambda p: (order_diff.get(str(p.get("difficulty", "")).lower(), 9), p["title"]))

    recommended: list[dict[str, str]] = []
    review_first: list[dict[str, str]] = []
    optional: list[dict[str, str]] = []

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


async def run_diagnostic_to_plan(topic: str, answers: dict[str, Any]) -> dict[str, Any]:
    analysis = interpret_diagnostic(topic, answers)
    plan = build_soft_plan(topic, answers, analysis)
    plan = await enrich_plan_with_llm(topic, plan)
    plan["diagnostic_analysis"] = analysis
    return plan
