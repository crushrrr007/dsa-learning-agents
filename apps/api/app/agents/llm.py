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
    1: "Help the student see why the slow approach struggles.",
    2: "Ask them to predict the next pointer/state change from the trace.",
    3: "Guide debugging of their own code using runner facts only.",
    4: "Probe edge cases and ask viva questions about their implementation.",
}


def llm_available() -> bool:
    settings = get_settings()
    return bool(settings.openai_api_key or os.getenv("OPENAI_API_KEY"))


async def chat_complete(system: str, user: str) -> str | None:
    settings = get_settings()
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)
        resp = await client.chat.completions.create(
            model=settings.openai_model,
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


def mock_tutor_reply(topic: str, notes: str, message: str) -> dict[str, str]:
    snippet = notes.strip().splitlines()
    concept = next((line for line in snippet if line and not line.startswith("#")), "Focus on the core pattern.")
    topic_hint = TOPIC_HINTS.get(topic, "Focus on the core invariant.")
    return {
        "reply": (
            f"From the {topic} notes: {concept} "
            f"{topic_hint} "
            f"You asked: “{message[:160]}”. "
            "I will not paste a full solution — try stating the invariant first."
        ),
        "guiding_question": {
            "trees": "What is true about both subtrees before you decide at this node?",
            "graphs": "Which neighbors are still unvisited, and why is that safe?",
            "dynamic-programming": "What does one DP cell represent in one sentence?",
            "linked-lists": "Which reference must you keep before changing next?",
            "sliding-window": "When should left advance, and what does that keep valid?",
            "two-pointers": "After the comparison, which pointer must move to make progress?",
            "arrays": "What is the loop invariant after each iteration?",
        }.get(topic, "What must remain true after each iteration of your approach?"),
    }


def mock_feedback_reply(stage: int, message: str, facts: dict[str, Any], topic: str = "arrays") -> dict[str, str]:
    insights = facts.get("ast_insights") or []
    error = facts.get("error")
    stage_hint = STAGE_HINTS.get(stage, STAGE_HINTS[3])
    topic_hint = TOPIC_HINTS.get(topic, "")
    if error:
        reply = (
            f"The runner reported: {error[:240]}. "
            f"{stage_hint} {topic_hint}"
        )
    elif insights:
        reply = f"Code facts: {insights[0]} {stage_hint} {topic_hint}"
    else:
        reply = (
            f"At stage {stage}, {stage_hint} "
            f"About “{message[:120]}”: compare your prediction with the traced locals. {topic_hint}"
        )
    question = {
        "trees": "In your last trace, which node was current, and what were its children?",
        "graphs": "Which node was marked visited last, and why?",
        "dynamic-programming": "Which DP cell did you just write, and what older cells did it use?",
    }.get(topic, "Which variable in the last trace event surprised you, and why?")
    return {"reply": reply.strip(), "guiding_question": question}
