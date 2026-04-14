from orchestrator.ui import UI
from orchestrator.llm_client import LLMClient
from orchestrator.context_builder import ContextBuilder
from orchestrator.tool_manager import ToolManager
from orchestrator.command_manager import CommandManager
from rich.live import Live
import ollama

class Orchestrator:
    def __init__(self, project_name, project_path):
        self.project_name = project_name
        self.project_path = project_path
        self.ui = UI()
        self.llm = LLMClient()
        self.context_builder = ContextBuilder()
        self.tool_manager = ToolManager(project_path)
        self.cmd_manager = CommandManager(self)
        self.active_agent = "architect"

    def start(self):
        self.ui.clear_screen()
        self._setup_initial_model()
        self.switch_agent(self.active_agent)
        self.ui.console.print(self.ui.get_layout(self.llm.total_tokens, self.llm.context_limit))

    def _setup_initial_model(self):
        try:
            models_info = ollama.list()
            available = [m.get('model') or m.get('name') for m in models_info.get('models', [])]
            default = "qwen2.5-coder:14b"
            model_to_use = default if default in available else (available[0] if available else None)
            if model_to_use:
                self.llm.set_model(model_to_use)
        except:
            pass

    def switch_agent(self, agent_name):
        self.active_agent = agent_name
        system_prompt = self.context_builder.build_prompt(agent_name)
        system_prompt += f"\n\nCURRENT_PROJECT: {self.project_name}"
        self.llm.clear_context(system_prompt)

    def process_command(self, user_input):
        if user_input.startswith("/"):
            self.cmd_manager.execute(user_input)
            return

        self.ui.update_history("user", user_input)
        agent_color = "magenta" if self.active_agent == "architect" else "cyan"

        with Live(self.ui.get_layout(self.llm.total_tokens, self.llm.context_limit, is_thinking=True, agent_name=self.active_agent), screen=True, auto_refresh=True) as live:

            tool_calls = []
            first_chunk = False

            for response in self.llm.chat_stream(user_input, tools=self.tool_manager.get_tools_definition()):
                if not first_chunk and "chunk" in response:
                    first_chunk = True
                    self.ui.update_history(self.active_agent, "", agent_color)

                if "chunk" in response:
                    self.ui.chat_history.append(response["chunk"], style=agent_color)
                    live.update(self.ui.get_layout(self.llm.total_tokens, self.llm.context_limit))

                if "tool_calls" in response:
                    tool_calls = response["tool_calls"]

            if tool_calls:
                for tc in tool_calls:
                    self.ui.update_history("system", f"Executing {tc['function']['name']}...", "yellow")
                    res = self.tool_manager.execute_tool(tc['function']['name'], tc['function']['arguments'])

                    live.update(self.ui.get_layout(self.llm.total_tokens, self.llm.context_limit, is_thinking=True, agent_name=self.active_agent))

                    self.ui.update_history(self.active_agent, "", agent_color)
                    for response in self.llm.chat_stream(user_message=f"Result: {res}"):
                        if "chunk" in response:
                            self.ui.chat_history.append(response["chunk"], style=agent_color)
                            live.update(self.ui.get_layout(self.llm.total_tokens, self.llm.context_limit))

        self.ui.console.clear()
        self.ui.console.print(self.ui.get_layout(self.llm.total_tokens, self.llm.context_limit))
