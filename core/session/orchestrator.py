from typing import Any, Dict, Generator
from core.llm.provider import LLMProvider
from core.session.memory import SessionMemory
from agents.factory import AgentFactory
from context.builder import ContextBuilder
from tools.manager import ToolManager

class SessionOrchestrator:
    def __init__(self, project_name: str, model_name: str, initial_role: str = "architect") -> None:
        self.project_name = project_name
        self.model_name = model_name
        self.llm = LLMProvider(model_name)
        self.memory = SessionMemory()
        self.context = ContextBuilder()
        self.tools = ToolManager(project_name)
        self.agent = AgentFactory.get_agent(initial_role)
        self.memory.set_active_persona(self.agent.role)

    def switch_agent(self, role: str) -> None:
        self.agent = AgentFactory.get_agent(role)
        self.memory.set_active_persona(self.agent.role)

    def stream_ask(self, user_input: str) -> Generator[str, None, None]:
        """Yields text deltas as the model streams. After exhaustion, _last_stream_message holds the complete message."""
        self.memory.add("user", user_input)

        system_prompt = self.context.build_system_prompt(
            agent_persona=self.agent.persona,
            project_state=f"Project: {self.project_name}",
        )
        messages = [{"role": "system", "content": system_prompt}] + self.memory.history
        all_definitions = self.tools.get_all_definitions()
        allowed_tools = [t for t in all_definitions if t["function"]["name"] in self.agent.tools]

        full_content = ""
        last_message: Dict[str, Any] = {"role": "assistant", "content": "", "tool_calls": None}

        for chunk in self.llm.stream(messages=messages, tools=allowed_tools or None):
            msg = chunk.get("message", {})
            delta = msg.get("content", "")
            if delta:
                full_content += delta
                yield delta
            if chunk.get("done") and msg.get("tool_calls"):
                last_message["tool_calls"] = msg["tool_calls"]

        last_message["content"] = full_content
        self._last_stream_message = last_message

    def ask(self, user_input: str) -> Dict[str, Any]:
        self.memory.add("user", user_input)

        system_prompt = self.context.build_system_prompt(
            agent_persona=self.agent.persona,
            project_state=f"Project: {self.project_name}",
        )

        messages = [{"role": "system", "content": system_prompt}] + self.memory.history

        all_definitions = self.tools.get_all_definitions()
        allowed_tools = [t for t in all_definitions if t["function"]["name"] in self.agent.tools]

        response = self.llm.chat(messages=messages, tools=allowed_tools)
        return response["message"]
