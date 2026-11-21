from __future__ import annotations

from typing import Any, Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.agents.llm import chat_complete, mock_feedback_reply, mock_tutor_reply
from app.agents.notes_store import retrieve_notes


class AgentState(TypedDict, total=False):
    stage: int
    topic: str
    message: str
    code: str
    facts: dict[str, Any]
    notes: str
    route: Literal["concept_tutor", "feedback_agent"]
    agent: str
    reply: str
    guiding_question: str


def choose_agent(stage: int, message: str) -> Literal["concept_tutor", "feedback_agent"]:
    lower = message.lower()
    if stage <= 0 or any(word in lower for word in ("concept", "explain", "why", "pattern", "notes", "invariant")):
        return "concept_tutor"
    return "feedback_agent"


def route_node(state: AgentState) -> AgentState:
    route = choose_agent(int(state.get("stage") or 0), state.get("message") or "")
    topic = state.get("topic") or "arrays"
    notes = retrieve_notes(topic, state.get("message") or topic)
    return {**state, "route": route, "notes": notes, "agent": route}


def pick_route(state: AgentState) -> Literal["concept_tutor", "feedback_agent"]:
    return state.get("route") or "concept_tutor"


async def concept_tutor_node(state: AgentState) -> AgentState:
    from app.agents.llm import STAGE_HINTS, TOPIC_HINTS

    topic = state.get("topic") or "arrays"
    notes = state.get("notes") or ""
    message = state.get("message") or ""
    stage = int(state.get("stage") or 0)
    llm = await chat_complete(
        system=(
            f"You are the Concept Tutor for {topic}. "
            f"Topic guidance: {TOPIC_HINTS.get(topic, '')} "
            f"Stage guidance: {STAGE_HINTS.get(stage, '')} "
            f"Use only these notes:\n{notes[:3000]}"
        ),
        user=message,
    )
    if llm:
        return {
            **state,
            "agent": "concept_tutor",
            "reply": llm,
            "guiding_question": "Can you restate the pattern in one sentence without code?",
        }
    mocked = mock_tutor_reply(topic, notes, message)
    return {**state, "agent": "concept_tutor", **mocked}


async def feedback_agent_node(state: AgentState) -> AgentState:
    from app.agents.llm import STAGE_HINTS, TOPIC_HINTS

    facts = state.get("facts") or {}
    stage = int(state.get("stage") or 0)
    code = state.get("code") or ""
    message = state.get("message") or ""
    topic = state.get("topic") or "arrays"
    fact_blob = {
        "ast_insights": facts.get("ast_insights", []),
        "error": facts.get("error"),
        "result": facts.get("result"),
        "code_excerpt": code[:500],
    }
    llm = await chat_complete(
        system=(
            f"You are the Feedback Agent for topic {topic}, stage {stage}. "
            f"Topic guidance: {TOPIC_HINTS.get(topic, '')} "
            f"Stage guidance: {STAGE_HINTS.get(stage, '')} "
            f"Facts from the runner/AST: {fact_blob}. "
            "Ask viva-style questions about the student's own code."
        ),
        user=message,
    )
    if llm:
        return {
            **state,
            "agent": "feedback_agent",
            "reply": llm,
            "guiding_question": "Which line in your code implements the key invariant?",
        }
    mocked = mock_feedback_reply(stage, message, fact_blob, topic=topic)
    return {**state, "agent": "feedback_agent", **mocked}


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("router", route_node)
    graph.add_node("concept_tutor", concept_tutor_node)
    graph.add_node("feedback_agent", feedback_agent_node)
    graph.set_entry_point("router")
    graph.add_conditional_edges(
        "router",
        pick_route,
        {
            "concept_tutor": "concept_tutor",
            "feedback_agent": "feedback_agent",
        },
    )
    graph.add_edge("concept_tutor", END)
    graph.add_edge("feedback_agent", END)
    return graph.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


async def run_coordinator(
    *,
    stage: int,
    topic: str | None,
    message: str,
    code: str | None = None,
    facts: dict[str, Any] | None = None,
) -> dict[str, str]:
    graph = get_graph()
    result = await graph.ainvoke(
        {
            "stage": stage,
            "topic": topic or "arrays",
            "message": message,
            "code": code or "",
            "facts": facts or {},
        }
    )
    return {
        "agent": result.get("agent") or "coordinator",
        "reply": result.get("reply") or "Ask a more specific question about the concept or your last run.",
        "guiding_question": result.get("guiding_question"),
    }
