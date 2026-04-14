import ollama
from orchestrator.ui import UI
from orchestrator.llm_client import LLMClient
from orchestrator.context_builder import ContextBuilder
from orchestrator.tool_manager import ToolManager
from orchestrator.command_manager import CommandManager

class Orchestrator:
    def __init__(self, project_name, project_path):
        self.project_name = project_name
        self.project_path = project_path
        self.active_agent = "architect"

        self.ui = UI()
        self.llm = LLMClient()
        self.context_builder = ContextBuilder()
        self.tool_manager = ToolManager(project_path)
        self.cmd_manager = CommandManager(self)

    def _setup_initial_model(self):
        models_info = ollama.list()

        available = []
        for m in models_info.get('models', []):
            if isinstance(m, dict):
                name = m.get('model') or m.get('name')
            else:
                name = getattr(m, 'model', getattr(m, 'name', None))

            if name:
                available.append(name)

        default = "qwen2.5-coder:14b"
        if default in available:
            self.llm.set_model(default)
            self.ui.log_action("System", f"Default model loaded: {default}")
        elif available:
            self.llm.set_model(available[0])
            self.ui.log_action("System", f"Default not found. Using: {available[0]}")
        else:
            self.ui.error("No models found in Ollama. Use /pull to download one.")

    def start(self):
        self.ui.display_message("system", f"Project: {self.project_name}")
        self._setup_initial_model()
        self.ui.log_action("Model Loaded", self.llm.model)
        self.switch_agent(self.active_agent)

    def switch_agent(self, agent_name):
        self.active_agent = agent_name
        self.ui.show_agent_status(agent_name)

        system_prompt = self.context_builder.build_prompt(agent_name)

        system_prompt += f"\n\nCURRENT_PROJECT: {self.project_name}"

        self.llm.clear_context(system_prompt)

    def process_command(self, user_input):
        if user_input.startswith("/"):
            self.cmd_manager.execute(user_input)
            return

        self.ui.display_message("user", user_input)

        with self.ui.console.status(f"[bold {self.active_agent}]The {self.active_agent} is thinking...", spinner="dots"):
            response = self.llm.chat(user_input, tools=self.tool_manager.get_tools_definition())

        if response.get('tool_calls'):
            for tool_call in response['tool_calls']:
                tool_name = tool_call['function']['name']
                tool_args = tool_call['function']['arguments']

                self.ui.log_action("Executing Tool", f"{tool_name}")

                result = self.tool_manager.execute_tool(tool_name, tool_args)
                self.ui.log_action("Tool Result", result)

                with self.ui.console.status("[dim]Processando resultado da ferramenta..."):
                    follow_up = self.llm.chat(
                        user_message=f"System Notification: Tool '{tool_name}' executed. Result: {result}"
                    )

                # Só exibe a resposta final após a ferramenta
                if follow_up.get('content'):
                    self.ui.display_message(self.active_agent, follow_up.get('content'))

        elif response.get('content'):
            content = response.get('content').strip()

            if content.startswith("```json") or content.startswith("{"):
                self.ui.log_action("System", "Model formatted tool as text. Ignoring...")
            else:
                self.ui.display_message(self.active_agent, content)
