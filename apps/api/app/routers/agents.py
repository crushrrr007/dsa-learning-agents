from fastapi import APIRouter

from app.agents.coordinator import run_coordinator
from app.agents.llm import AGENT_ROLES, llm_status
from app.content_loader import get_problem
from app.schemas import AgentChatRequest, AgentChatResponse

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/status")
async def agents_status():
    status = llm_status()
    return {
        "ok": True,
        "agents": list(AGENT_ROLES.keys()),
        "roles": AGENT_ROLES,
        "llm": status,
    }


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(body: AgentChatRequest) -> AgentChatResponse:
    topic = body.topic
    if not topic and body.problem_id:
        try:
            topic = get_problem(body.problem_id)["topic"]
        except KeyError:
            topic = "arrays"
    result = await run_coordinator(
        stage=body.stage,
        topic=topic,
        message=body.message,
        code=body.code,
        facts=body.last_run or {},
        preferred_agent=body.preferred_agent,
        session_id=body.session_id,
        problem_id=body.problem_id,
    )
    status = llm_status()
    return AgentChatResponse(
        agent=result["agent"],
        agent_label=result.get("agent_label"),
        reply=result["reply"],
        guiding_question=result.get("guiding_question"),
        llm_mode=status["provider"],
        routing_reason=result["routing_reason"],
        reply_source=result["reply_source"],
        guard_triggered=bool(result.get("guard_triggered")),
        regenerated=bool(result.get("regenerated")),
    )
