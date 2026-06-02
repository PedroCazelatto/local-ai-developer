import os
import time
from collections.abc import Generator
from typing import Any

import ollama

from agents.factory import AgentFactory
from context.builder import ContextBuilder
from core.container.client import DockerClient
from core.llm.provider import LLMProvider
from core.llm.tool_call_recovery import recover_tool_calls
from core.session.audit import ToolAuditLogger
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
            project_name=project_name,
            project_path=os.path.abspath(f"./projects/{project_name}"),
            docker=DockerClient(container_name=SANDBOX_CONTAINER),
        )
        self.audit = ToolAuditLogger(self.tool_ctx.project_path)
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
        started = time.perf_counter()
        error: str | None = None
        exit_status = 0
        output = ""
        metadata = self.tools.audit_metadata(name, self.tool_ctx, args)
        try:
            output = self.tools.call(name, self.tool_ctx, args)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            exit_status = -1
            output = f"Error: {error}"
        finally:
            self.audit.record(
                persona=self.agent.role,
                tool=name,
                args=args,
                output=output,
                duration_ms=int((time.perf_counter() - started) * 1000),
                exit_status=exit_status,
                error=error,
                metadata=metadata,
            )
        return output

    def _build_messages(self) -> list[dict[str, Any]]:
        system_prompt = self.context.build_system_prompt(
            agent_persona=self.agent.persona,
            project_state=f"Project: {self.project_name}",
        )
        return [{"role": "system", "content": system_prompt}] + self.memory.history

    def stream_ask(self, user_input: str) -> Generator[str, None, None]:
        """Add `user_input` to memory and stream the model's reply. After
        exhaustion, `last_stream_message` holds the complete message."""
        self.memory.add("user", user_input)
        yield from self._stream()

    def stream_continue(self) -> Generator[str, None, None]:
        """Stream the next assistant turn from current memory without injecting
        a user message. Use after a tool result so the model continues naturally."""
        yield from self._stream()

    def _stream(self) -> Generator[str, None, None]:
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

        if not last_message["tool_calls"]:
            cleaned, recovered = recover_tool_calls(full_content)
            if recovered:
                last_message["tool_calls"] = recovered
                full_content = cleaned

        last_message["content"] = full_content
        self.last_stream_message = last_message

    def ask(self, user_input: str) -> dict[str, Any]:
        self.memory.add("user", user_input)
        response = self.llm.chat(messages=self._build_messages(), tools=self.tools.definitions)
        self._update_token_counts(response)
        return response["message"]
