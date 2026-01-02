from typing import Any, AsyncIterable, ClassVar, Dict, List, Literal

from pydantic import BaseModel

from app.agent.vazal import Vazal


class ResponseFormat(BaseModel):
    """Respond to the user in this format."""

    status: Literal["input_required", "completed", "error"] = "input_required"
    message: str


class A2AVazal(Vazal):
    async def invoke(self, query, sessionId) -> str:
        config = {"configurable": {"thread_id": sessionId}}
        response = await self.run(query)
        return self.get_agent_response(config, response)

    async def stream(self, query: str) -> AsyncIterable[Dict[str, Any]]:
        """Streaming is not supported by Vazal."""
        raise NotImplementedError("Streaming is not supported by Vazal yet.")

    def get_agent_response(self, config, agent_response):
        return {
            "is_task_complete": True,
            "require_user_input": False,
            "content": agent_response,
        }

    SUPPORTED_CONTENT_TYPES: ClassVar[List[str]] = ["text", "text/plain"]
