from __future__ import annotations

from typing import Any, TypedDict

from app.agents.llm import chat_complete, mock_feedback_reply, mock_tutor_reply
from app.agents.notes_store import retrieve_notes


class AgentState(TypedDict, total=False):
    stage: int
    topic: str
    message: str
    code: str
    facts: dict[str, Any]
    agent: str
    reply: str
    guiding_question: str


def choose_agent(stage: int, message: str) -> str:
    lower = message.lower()
    if stage <= 0 or any(word in lower for word in ("concept", "explain", "why", "pattern", "notes")):
        return "concept_tutor"
    return "feedback_agent"


async def run_coordinator(
    *,
    stage: int,
    topic: str | None,
    message: str,
    code: str | None = None,
    facts: dict[str, Any] | None = None,
) -> dict[str, str]:
    facts = facts or {}
    topic_slug = topic or "arrays"
    agent = choose_agent(stage, message)
    notes = retrieve_notes(topic_slug, message)

    if agent == "concept_tutor":
        llm = await chat_complete(
            system=f"You are the Concept Tutor for {topic_slug}. Use only these notes:\n{notes[:3000]}",
            user=message,
        )
        if llm:
            return {
                "agent": agent,
                "reply": llm,
                "guiding_question": "Can you restate the pattern in one sentence without code?",
            }
        mocked = mock_tutor_reply(topic_slug, notes, message)
        return {"agent": agent, **mocked}

    # feedback agent
    fact_blob = {
        "ast_insights": facts.get("ast_insights", []),
        "error": facts.get("error"),
        "result": facts.get("result"),
        "code_excerpt": (code or "")[:500],
    }
    llm = await chat_complete(
        system=(
            f"You are the Feedback Agent for stage {stage}. "
            f"Facts from the runner/AST: {fact_blob}. "
            "Ask viva-style questions about the student's own code."
        ),
        user=message,
    )
    if llm:
        return {
            "agent": agent,
            "reply": llm,
            "guiding_question": "Which line in your code implements the key invariant?",
        }
    mocked = mock_feedback_reply(stage, message, fact_blob)
    return {"agent": agent, **mocked}
