import os
from collections.abc import Generator
from typing import Any

from agents.factory import AgentFactory
from context.builder import ContextBuilder
from core.container.client import DockerClient
from core.llm.provider import LLMProvider
from core.session.memory import SessionMemory
from tools.base import ToolContext
from tools.factories import ToolFactory

SANDBOX_CONTAINER = "ai_sandbox"


class SessionOrchestrator:
    def __init__(self, project_name: str, model_name: str, initial_role: str = "architect") -> None:
        self.project_name = project_name
        self.model_name = model_name
        self.llm = LLMProvider(model_name)
        self.memory = SessionMemory()
        self.context = ContextBuilder()
        self.tools = ToolFactory()
        self.tool_ctx = ToolContext(
            project_path=os.path.abspath(f"./projects/{project_name}"),
            docker=DockerClient(container_name=SANDBOX_CONTAINER),
        )
        self.agent = AgentFactory.get_agent(initial_role)
        self.memory.set_active_persona(self.agent.role)
        self._last_stream_message: dict[str, Any] = {}

    def switch_agent(self, role: str) -> None:
        self.agent = AgentFactory.get_agent(role)
        self.memory.set_active_persona(self.agent.role)

    def call_tool(self, name: str, args: dict[str, object]) -> str:
        return self.tools.call(name, self.tool_ctx, args)

    def _build_messages(self) -> list[dict[str, Any]]:
        system_prompt = self.context.build_system_prompt(
            agent_persona=self.agent.persona,
            project_state=f"Project: {self.project_name}",
        )
        return [{"role": "system", "content": system_prompt}] + self.memory.history

    def _allowed_tools(self) -> list[dict[str, object]] | None:
        allowed = [t for t in self.tools.definitions if t["function"]["name"] in self.agent.tools]
        return allowed or None

    def stream_ask(self, user_input: str) -> Generator[str, None, None]:
        """Yields text deltas as the model streams. After exhaustion, `_last_stream_message` holds the complete message."""
        self.memory.add("user", user_input)

        full_content = ""
        last_message: dict[str, Any] = {"role": "assistant", "content": "", "tool_calls": None}

        for chunk in self.llm.stream(messages=self._build_messages(), tools=self._allowed_tools()):
            msg = chunk.get("message", {})
            delta = msg.get("content", "")
            if delta:
                full_content += delta
                yield delta
            if chunk.get("done") and msg.get("tool_calls"):
                last_message["tool_calls"] = msg["tool_calls"]

        last_message["content"] = full_content
        self._last_stream_message = last_message

    def ask(self, user_input: str) -> dict[str, Any]:
        self.memory.add("user", user_input)
        response = self.llm.chat(messages=self._build_messages(), tools=self._allowed_tools())
        return response["message"]
