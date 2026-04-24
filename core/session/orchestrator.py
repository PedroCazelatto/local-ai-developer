from typing import Any, Dict
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
