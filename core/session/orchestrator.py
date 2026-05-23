import os
from collections.abc import Generator
from typing import Any

import ollama

from agents.factory import AgentFactory
from context.builder import ContextBuilder
from core.container.client import DockerClient
from core.llm.provider import LLMProvider
from core.session.memory import SessionMemory
from tools.base import ToolContext
from tools.factories import ToolFactory

SANDBOX_CONTAINER = "ai_sandbox"


class SessionOrchestrator:
    def __init__(self, project_name: str, model_name: str, num_ctx: int, initial_role: str = "architect") -> None:
        self.project_name = project_name
        self.model_name = model_name
        self.num_ctx = num_ctx
        self.llm = LLMProvider(model_name, num_ctx)
        self.memory = SessionMemory()
        self.context = ContextBuilder()
        self.tools = ToolFactory()
        self.tool_ctx = ToolContext(
            project_path=os.path.abspath(f"./projects/{project_name}"),
            docker=DockerClient(container_name=SANDBOX_CONTAINER),
        )
        self.agent = AgentFactory.get_agent(initial_role)
        self.memory.set_active_persona(self.agent.role)
        self.last_stream_message: dict[str, Any] = {}
        self.last_prompt_tokens: int = 0
        self.last_eval_tokens: int = 0

    @property
    def last_token_count(self) -> int:
        return self.last_prompt_tokens + self.last_eval_tokens

    def _update_token_counts(self, response: ollama.ChatResponse) -> None:
        self.last_prompt_tokens = response.prompt_eval_count or 0
        self.last_eval_tokens = response.eval_count or 0

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

    def stream_ask(self, user_input: str) -> Generator[str, None, None]:
        """Yields text deltas as the model streams. After exhaustion, `last_stream_message` holds the complete message."""
        self.memory.add("user", user_input)

        full_content = ""
        last_message: dict[str, Any] = {"role": "assistant", "content": "", "tool_calls": None}

        for chunk in self.llm.stream(messages=self._build_messages(), tools=self.tools.definitions):
            msg = chunk.get("message", {})
            delta = msg.get("content", "")
            if delta:
                full_content += delta
                yield delta
            if chunk.get("done"):
                if msg.get("tool_calls"):
                    last_message["tool_calls"] = msg["tool_calls"]
                self._update_token_counts(chunk)

        last_message["content"] = full_content
        self.last_stream_message = last_message

    def ask(self, user_input: str) -> dict[str, Any]:
        self.memory.add("user", user_input)
        response = self.llm.chat(messages=self._build_messages(), tools=self.tools.definitions)
        self._update_token_counts(response)
        return response["message"]
