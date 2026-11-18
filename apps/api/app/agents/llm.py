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
    return {
        "reply": (
            f"From the {topic} notes: {concept} "
            f"You asked: “{message[:160]}”. "
            "I will not paste a full solution — try stating the invariant first."
        ),
        "guiding_question": "What must remain true after each iteration of your approach?",
    }


def mock_feedback_reply(stage: int, message: str, facts: dict[str, Any]) -> dict[str, str]:
    insights = facts.get("ast_insights") or []
    error = facts.get("error")
    if error:
        reply = f"The runner reported: {error[:240]}. Inspect the failing line before changing strategy."
    elif insights:
        reply = f"Code facts: {insights[0]} Use that to adjust one pointer or bound at a time."
    else:
        reply = (
            f"At stage {stage}, focus on explaining your last change. "
            f"About “{message[:120]}”: compare your prediction with the traced locals."
        )
    return {
        "reply": reply,
        "guiding_question": "Which variable in the last trace event surprised you, and why?",
    }
