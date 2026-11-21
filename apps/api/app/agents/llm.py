from __future__ import annotations

import os
from typing import Any

from app.config import get_settings


NO_SOLUTION_POLICY = (
    "You are a DSA teaching assistant. Never provide a complete working solution or paste full code. "
    "Teach with short hints, questions, and explanations of concepts. "
    "Ground claims in provided trace/AST facts when available. "
    "If asked for the full answer, refuse and ask a guiding question instead."
)

TOPIC_HINTS = {
    "arrays": "Focus on indices, in-place swaps, and loop bounds.",
    "two-pointers": "Ask which pointer moves after each comparison and why.",
    "sliding-window": "Ask when the window should expand vs shrink.",
    "linked-lists": "Ask which next-pointer must be saved before rewiring.",
    "trees": "Ask about the null base case and how left/right answers combine.",
    "graphs": "Ask about visited marking and BFS layers vs DFS paths.",
    "dynamic-programming": "Ask what one DP cell means and which prior cells it needs.",
}

STAGE_HINTS = {
    0: "Stay at the concept level; do not jump into coding details.",
    1: "Help the student see why the slow approach struggles; narrate the demo trace.",
    2: "Ask them to predict the next pointer/state change from the trace.",
    3: "Guide debugging of their own code using runner facts only.",
    4: "Probe edge cases and ask viva questions about their implementation.",
}

AGENT_ROLES = {
    "concept_tutor": "Concept Tutor — teach the pattern from notes; no coding yet.",
    "demo_coach": "Demo Coach — narrate brute-force vs better approach using trace frames.",
    "predict_coach": "Predict Coach — check step predictions against traced state.",
    "code_mentor": "Code Mentor — hint from AST/errors/tests; never paste a solution.",
    "viva_agent": "Viva Agent — oral-style probes about complexity and edge cases.",
}

AgentName = str


def resolve_llm_config() -> dict[str, str | None]:
    """Resolve API key / base URL / model with free-tier Groq defaults."""
    settings = get_settings()
    api_key = (
        settings.llm_api_key
        or settings.openai_api_key
        or os.getenv("LLM_API_KEY")
        or os.getenv("GROQ_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    base_url = (
        settings.openai_base_url
        or os.getenv("LLM_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
        or settings.llm_base_url
    )
    # If only a classic OpenAI key is set (sk-… without Groq), use OpenAI host/model.
    if api_key and api_key.startswith("sk-") and "groq" not in (base_url or "").lower() and not (
        settings.llm_api_key or os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY")
    ):
        if not settings.openai_base_url and not os.getenv("LLM_BASE_URL"):
            base_url = "https://api.openai.com/v1"
        model = settings.openai_model or os.getenv("LLM_MODEL") or "gpt-4o-mini"
    else:
        model = (
            settings.openai_model
            or os.getenv("LLM_MODEL")
            or settings.llm_model
        )
    return {"api_key": api_key, "base_url": base_url, "model": model}


def llm_available() -> bool:
    return bool(resolve_llm_config()["api_key"])


def llm_status() -> dict[str, Any]:
    cfg = resolve_llm_config()
    if not cfg["api_key"]:
        return {
            "configured": False,
            "provider": "mock",
            "model": "mock",
            "base_url": None,
            "default_host": cfg["base_url"],
        }
    provider = "groq" if cfg["base_url"] and "groq" in (cfg["base_url"] or "") else "openai"
    return {
        "configured": True,
        "provider": provider,
        "model": cfg["model"],
        "base_url": cfg["base_url"],
    }


def summarize_facts(facts: dict[str, Any], code: str = "") -> dict[str, Any]:
    """Compact runner/AST/trace context for agent prompts."""
    events = facts.get("events") or []
    last_event = events[-1] if isinstance(events, list) and events else None
    return {
        "ast_insights": (facts.get("ast_insights") or [])[:5],
        "error": facts.get("error"),
        "result": facts.get("result"),
        "ok": facts.get("ok"),
        "passed": facts.get("passed"),
        "failed_case": facts.get("failed_case"),
        "event_count": len(events) if isinstance(events, list) else 0,
        "last_event": last_event,
        "code_excerpt": (code or "")[:500],
    }


async def chat_complete(system: str, user: str) -> str | None:
    cfg = resolve_llm_config()
    api_key = cfg["api_key"]
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key, base_url=cfg["base_url"])
        resp = await client.chat.completions.create(
            model=cfg["model"] or "openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": f"{NO_SOLUTION_POLICY}\n{system}"},
                {"role": "user", "content": user},
            ],
            temperature=0.4,
            max_tokens=400,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        return f"(LLM unavailable: {exc})"


def _topic_question(topic: str) -> str:
    return {
        "trees": "What is true about both subtrees before you decide at this node?",
        "graphs": "Which neighbors are still unvisited, and why is that safe?",
        "dynamic-programming": "What does one DP cell represent in one sentence?",
        "linked-lists": "Which reference must you keep before changing next?",
        "sliding-window": "When should left advance, and what does that keep valid?",
        "two-pointers": "After the comparison, which pointer must move to make progress?",
        "arrays": "What is the loop invariant after each iteration?",
    }.get(topic, "What must remain true after each iteration of your approach?")


def mock_agent_reply(
    agent: str,
    *,
    topic: str,
    stage: int,
    message: str,
    notes: str = "",
    facts: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Deterministic replies when no LLM key is configured."""
    facts = facts or {}
    topic_hint = TOPIC_HINTS.get(topic, "Focus on the core invariant.")
    stage_hint = STAGE_HINTS.get(stage, STAGE_HINTS[3])
    role = AGENT_ROLES.get(agent, "Teaching agent")

    if agent == "concept_tutor":
        snippet = notes.strip().splitlines()
        concept = next(
            (line for line in snippet if line and not line.startswith("#")),
            "Focus on the core pattern.",
        )
        return {
            "reply": (
                f"[{role}] From the {topic} notes: {concept} {topic_hint} "
                f"You asked: “{message[:160]}”. I will not paste a full solution — state the invariant first."
            ),
            "guiding_question": _topic_question(topic),
        }

    if agent == "demo_coach":
        n = facts.get("event_count") or 0
        last = facts.get("last_event")
        last_bit = f" Last frame locals: {last.get('locals')}" if isinstance(last, dict) and last.get("locals") else ""
        return {
            "reply": (
                f"[{role}] Demo trace has {n} frames. {stage_hint} "
                f"Watch which indices/nodes change each step.{last_bit} {topic_hint}"
            ),
            "guiding_question": "In the next frame, which variable should change — and why?",
        }

    if agent == "predict_coach":
        return {
            "reply": (
                f"[{role}] Compare your prediction with the traced locals before moving on. "
                f"{stage_hint} About “{message[:120]}”: name the next state change only. {topic_hint}"
            ),
            "guiding_question": "What are left/right (or current node) *after* this step?",
        }

    if agent == "code_mentor":
        error = facts.get("error")
        insights = facts.get("ast_insights") or []
        if error:
            reply = f"[{role}] Runner error: {str(error)[:240]}. {stage_hint} {topic_hint}"
        elif insights:
            reply = f"[{role}] Code fact: {insights[0]} {stage_hint} Fix the smallest broken part. {topic_hint}"
        else:
            reply = (
                f"[{role}] {stage_hint} Re-run and compare expected vs your result. "
                f"About “{message[:120]}”. {topic_hint}"
            )
        return {
            "reply": reply.strip(),
            "guiding_question": "Which single line implements (or breaks) the invariant?",
        }

    # viva_agent
    return {
        "reply": (
            f"[{role}] {stage_hint} Defend your approach for {topic}: complexity, "
            f"one edge case, and what would break if the invariant slipped. "
            f"You said: “{message[:120]}”."
        ),
        "guiding_question": {
            "trees": "What is the base case, and what is the recurrence?",
            "graphs": "Why does visited prevent infinite work?",
            "dynamic-programming": "Name the DP state and the transition in words.",
        }.get(topic, "What is the time complexity, and which input forces the worst case?"),
    }


# Back-compat helpers used by older imports
def mock_tutor_reply(topic: str, notes: str, message: str) -> dict[str, str]:
    return mock_agent_reply("concept_tutor", topic=topic, stage=0, message=message, notes=notes)


def mock_feedback_reply(stage: int, message: str, facts: dict[str, Any], topic: str = "arrays") -> dict[str, str]:
    agent = "viva_agent" if stage >= 4 else "code_mentor"
    return mock_agent_reply(agent, topic=topic, stage=stage, message=message, facts=facts)
