from fastapi import APIRouter

from app.agents.coordinator import run_coordinator
from app.content_loader import get_problem
from app.schemas import AgentChatRequest, AgentChatResponse

router = APIRouter(prefix="/agents", tags=["agents"])


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
    )
    return AgentChatResponse(
        agent=result["agent"],
        reply=result["reply"],
        guiding_question=result.get("guiding_question"),
    )
