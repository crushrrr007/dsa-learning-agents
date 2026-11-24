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
from app.agents.solution_guard import (
    detect_solution_leak,
    log_guard_event,
    regenerate_without_solution,
    safe_fallback_reply,
)
from app.content_loader import get_problem

AgentRoute = Literal[
    "concept_tutor",
    "demo_coach",
    "predict_coach",
    "code_mentor",
    "viva_agent",
]


RoutingReason = Literal["requested", "question", "stage"]
ReplySource = Literal["model", "local", "guard_fallback"]

VALID_AGENTS: tuple[AgentRoute, ...] = (
    "concept_tutor",
    "demo_coach",
    "predict_coach",
    "code_mentor",
    "viva_agent",
)


class AgentState(TypedDict, total=False):
    stage: int
    topic: str
    message: str
    code: str
    facts: dict[str, Any]
    notes: str
    preferred_agent: str
    route: AgentRoute
    routing_reason: RoutingReason
    reply_source: ReplySource
    agent: str
    reply: str
    guiding_question: str
    agent_label: str
    session_id: str
    problem_id: str
    function_name: str
    reference_solution: str
    guard_triggered: bool
    regenerated: bool
    guard_reason: str


def route_agent(stage: int, message: str, preferred: str | None = None) -> tuple[AgentRoute, RoutingReason]:
    """Route by explicit pick, then question intent, then learning stage."""
    for agent in VALID_AGENTS:
        if preferred == agent:
            return agent, "requested"
    lower = (message or "").lower()
    if any(
        phrase in lower
        for phrase in ("viva", "time complexity", "space complexity", "edge case", "defend your", "interview question")
    ):
        return "viva_agent", "question"
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
        return "concept_tutor", "question"
    if stage <= 0:
        return "concept_tutor", "stage"
    if stage == 1:
        return "demo_coach", "stage"
    if stage == 2:
        return "predict_coach", "stage"
    if stage == 3:
        return "code_mentor", "stage"
    return "viva_agent", "stage"


def choose_agent(stage: int, message: str, preferred: str | None = None) -> AgentRoute:
    return route_agent(stage, message, preferred)[0]


def route_node(state: AgentState) -> AgentState:
    route, reason = route_agent(
        int(state.get("stage") or 0),
        state.get("message") or "",
        state.get("preferred_agent"),
    )
    topic = state.get("topic") or "arrays"
    notes = retrieve_notes(topic, state.get("message") or topic)
    return {
        **state,
        "route": route,
        "routing_reason": reason,
        "notes": notes,
        "agent": route,
        "agent_label": AGENT_ROLES.get(route, route),
        "guard_triggered": False,
        "regenerated": False,
        "guard_reason": "",
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
            "reply_source": "model",
            "guiding_question": questions.get(agent),
        }

    local_reply = mock_agent_reply(agent, topic=topic, stage=stage, message=message, notes=notes, facts=facts)
    return {**state, "agent": agent, "agent_label": role, "reply_source": "local", **local_reply}


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


async def guard_node(state: AgentState) -> AgentState:
    """Run after every agent; block leaked full solutions before END."""
    reply = state.get("reply") or ""
    function_name = state.get("function_name") or ""
    reference_solution = state.get("reference_solution") or ""
    topic = state.get("topic") or "arrays"
    stage = int(state.get("stage") or 0)
    agent = state.get("agent") or "coordinator"
    session_id = state.get("session_id") or ""
    problem_id = state.get("problem_id") or ""

    leaked, reason = await detect_solution_leak(
        reply,
        function_name=function_name,
        reference_solution=reference_solution,
        use_llm=True,
    )
    if not leaked:
        log_guard_event(
            session_id=session_id,
            agent=agent,
            problem_id=problem_id,
            guard_triggered=False,
            regenerated=False,
        )
        return {
            **state,
            "guard_triggered": False,
            "regenerated": False,
            "guard_reason": "",
        }

    # Regenerate once with a stricter policy — never put reference_solution in the prompt.
    regenerated_reply = await regenerate_without_solution(
        agent=agent,
        topic=topic,
        stage=stage,
        message=state.get("message") or "",
        prior_reply=reply,
    )
    if regenerated_reply:
        still_leaked, regen_reason = await detect_solution_leak(
            regenerated_reply,
            function_name=function_name,
            reference_solution=reference_solution,
            use_llm=False,  # cheap checks only on the second pass
        )
        if not still_leaked:
            log_guard_event(
                session_id=session_id,
                agent=agent,
                problem_id=problem_id,
                guard_triggered=True,
                regenerated=True,
                reason=reason,
            )
            return {
                **state,
                "reply": regenerated_reply,
                "reply_source": "model",
                "guard_triggered": True,
                "regenerated": True,
                "guard_reason": reason,
            }
        reason = regen_reason or reason

    fallback = safe_fallback_reply(topic=topic, stage=stage, agent=agent)
    log_guard_event(
        session_id=session_id,
        agent=agent,
        problem_id=problem_id,
        guard_triggered=True,
        regenerated=True,
        reason=reason or "fallback",
    )
    return {
        **state,
        "reply": fallback["reply"],
        "reply_source": "guard_fallback",
        "guiding_question": fallback["guiding_question"],
        "guard_triggered": True,
        "regenerated": True,
        "guard_reason": reason or "fallback",
    }


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("router", route_node)
    graph.add_node("concept_tutor", concept_tutor_node)
    graph.add_node("demo_coach", demo_coach_node)
    graph.add_node("predict_coach", predict_coach_node)
    graph.add_node("code_mentor", code_mentor_node)
    graph.add_node("viva_agent", viva_agent_node)
    graph.add_node("guard", guard_node)
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
        graph.add_edge(name, "guard")
    graph.add_edge("guard", END)
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
    preferred_agent: str | None = None,
    session_id: str | None = None,
    problem_id: str | None = None,
) -> dict[str, Any]:
    function_name = ""
    reference_solution = ""
    resolved_topic = topic or "arrays"
    if problem_id:
        try:
            problem = get_problem(problem_id)
            function_name = str(problem.get("function_name") or "")
            reference_solution = str(problem.get("reference_solution") or "")
            resolved_topic = topic or str(problem.get("topic") or resolved_topic)
        except KeyError:
            pass

    graph = get_graph()
    result = await graph.ainvoke(
        {
            "stage": stage,
            "topic": resolved_topic,
            "message": message,
            "code": code or "",
            "facts": facts or {},
            "preferred_agent": preferred_agent or "",
            "session_id": session_id or "",
            "problem_id": problem_id or "",
            "function_name": function_name,
            # Server-side only — never returned to clients or hint prompts.
            "reference_solution": reference_solution,
        }
    )
    return {
        "agent": result.get("agent") or "coordinator",
        "agent_label": result.get("agent_label"),
        "reply": result.get("reply") or "Ask a more specific question about the concept or your last run.",
        "guiding_question": result.get("guiding_question"),
        "routing_reason": result.get("routing_reason", "stage"),
        "reply_source": result.get("reply_source", "local"),
        "guard_triggered": bool(result.get("guard_triggered")),
        "regenerated": bool(result.get("regenerated")),
    }
