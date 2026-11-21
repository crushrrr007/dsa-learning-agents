from __future__ import annotations

from typing import Any, Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.agents.llm import (
    AGENT_ROLES,
    STAGE_HINTS,
    TOPIC_HINTS,
    chat_complete,
    mock_agent_reply,
    summarize_facts,
)
from app.agents.notes_store import retrieve_notes

AgentRoute = Literal[
    "concept_tutor",
    "demo_coach",
    "predict_coach",
    "code_mentor",
    "viva_agent",
]


class AgentState(TypedDict, total=False):
    stage: int
    topic: str
    message: str
    code: str
    facts: dict[str, Any]
    notes: str
    route: AgentRoute
    agent: str
    reply: str
    guiding_question: str
    agent_label: str


def choose_agent(stage: int, message: str) -> AgentRoute:
    """Route by learning stage; explicit phrases can override."""
    lower = (message or "").lower()
    # Prefer viva probes when the student asks for them at any stage.
    if any(phrase in lower for phrase in ("viva", "time complexity", "space complexity", "edge case", "defend your", "interview question")):
        return "viva_agent"
    # Concept override only for explicit concept/notes asks (avoid bare "why").
    if any(
        phrase in lower
        for phrase in (
            "concept",
            "explain the pattern",
            "explain the concept",
            "from the notes",
            "what is the invariant",
            "quiz",
        )
    ):
        return "concept_tutor"
    if stage <= 0:
        return "concept_tutor"
    if stage == 1:
        return "demo_coach"
    if stage == 2:
        return "predict_coach"
    if stage == 3:
        return "code_mentor"
    return "viva_agent"


def route_node(state: AgentState) -> AgentState:
    route = choose_agent(int(state.get("stage") or 0), state.get("message") or "")
    topic = state.get("topic") or "arrays"
    notes = retrieve_notes(topic, state.get("message") or topic)
    return {
        **state,
        "route": route,
        "notes": notes,
        "agent": route,
        "agent_label": AGENT_ROLES.get(route, route),
    }


def pick_route(state: AgentState) -> AgentRoute:
    return state.get("route") or "concept_tutor"


async def _reply_for(agent: AgentRoute, state: AgentState) -> AgentState:
    topic = state.get("topic") or "arrays"
    stage = int(state.get("stage") or 0)
    message = state.get("message") or ""
    notes = state.get("notes") or ""
    code = state.get("code") or ""
    facts = summarize_facts(state.get("facts") or {}, code)
    role = AGENT_ROLES.get(agent, agent)

    system = (
        f"You are the {role} for topic `{topic}` at stage {stage}. "
        f"Topic guidance: {TOPIC_HINTS.get(topic, '')} "
        f"Stage guidance: {STAGE_HINTS.get(stage, '')} "
        f"Grounding facts (runner/AST/trace): {facts}. "
    )
    if agent == "concept_tutor":
        system += f"Use only these notes:\n{notes[:3000]}"
    elif agent == "demo_coach":
        system += "Narrate what the demo trace is showing; contrast brute force vs the target pattern."
    elif agent == "predict_coach":
        system += "Help the student predict the next state; confirm or gently correct without giving full code."
    elif agent == "code_mentor":
        system += "Debug from facts only; suggest the next micro-fix, not a full rewrite."
    else:
        system += "Ask viva-style questions about complexity, invariants, and edge cases."

    llm = await chat_complete(system=system, user=message)
    if llm and not llm.startswith("(LLM unavailable:"):
        questions = {
            "concept_tutor": "Can you restate the pattern in one sentence without code?",
            "demo_coach": "In the next frame, which variable should change — and why?",
            "predict_coach": "What are the pointer/node values after this step?",
            "code_mentor": "Which line in your code implements the key invariant?",
            "viva_agent": "What input would break your approach if the invariant slipped?",
        }
        return {
            **state,
            "agent": agent,
            "agent_label": role,
            "reply": llm,
            "guiding_question": questions.get(agent),
        }

    if llm and llm.startswith("(LLM unavailable:"):
        mocked = mock_agent_reply(agent, topic=topic, stage=stage, message=message, notes=notes, facts=facts)
        mocked["reply"] = f"{llm}\n\nFalling back to local coach:\n{mocked['reply']}"
        return {**state, "agent": agent, "agent_label": role, **mocked}

    mocked = mock_agent_reply(agent, topic=topic, stage=stage, message=message, notes=notes, facts=facts)
    return {**state, "agent": agent, "agent_label": role, **mocked}


async def concept_tutor_node(state: AgentState) -> AgentState:
    return await _reply_for("concept_tutor", state)


async def demo_coach_node(state: AgentState) -> AgentState:
    return await _reply_for("demo_coach", state)


async def predict_coach_node(state: AgentState) -> AgentState:
    return await _reply_for("predict_coach", state)


async def code_mentor_node(state: AgentState) -> AgentState:
    return await _reply_for("code_mentor", state)


async def viva_agent_node(state: AgentState) -> AgentState:
    return await _reply_for("viva_agent", state)


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("router", route_node)
    graph.add_node("concept_tutor", concept_tutor_node)
    graph.add_node("demo_coach", demo_coach_node)
    graph.add_node("predict_coach", predict_coach_node)
    graph.add_node("code_mentor", code_mentor_node)
    graph.add_node("viva_agent", viva_agent_node)
    graph.set_entry_point("router")
    graph.add_conditional_edges(
        "router",
        pick_route,
        {
            "concept_tutor": "concept_tutor",
            "demo_coach": "demo_coach",
            "predict_coach": "predict_coach",
            "code_mentor": "code_mentor",
            "viva_agent": "viva_agent",
        },
    )
    for name in ("concept_tutor", "demo_coach", "predict_coach", "code_mentor", "viva_agent"):
        graph.add_edge(name, END)
    return graph.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


def reset_graph() -> None:
    """Test helper to rebuild after code changes."""
    global _GRAPH
    _GRAPH = None


async def run_coordinator(
    *,
    stage: int,
    topic: str | None,
    message: str,
    code: str | None = None,
    facts: dict[str, Any] | None = None,
) -> dict[str, str | None]:
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
        "agent_label": result.get("agent_label"),
        "reply": result.get("reply") or "Ask a more specific question about the concept or your last run.",
        "guiding_question": result.get("guiding_question"),
    }
