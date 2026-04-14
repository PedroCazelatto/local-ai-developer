from orchestrator.ui import UI
from orchestrator.llm_client import LLMClient
from orchestrator.context_builder import ContextBuilder
from orchestrator.tool_manager import ToolManager
from orchestrator.command_manager import CommandManager
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
        self.ui.display_message("system", f"Project Context: {self.project_name}")
        self._setup_initial_model()
        self.switch_agent(self.active_agent)

    def _setup_initial_model(self):
        try:
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
                self.ui.error("No models found. Use /models pull <name>")
        except Exception as e:
            self.ui.error(f"Initialization error: {str(e)}")

    def switch_agent(self, agent_name):
        self.active_agent = agent_name
        self.ui.show_agent_status(agent_name)
        system_prompt = self.context_builder.build_prompt(agent_name)
        system_prompt += f"\n\nCURRENT_PROJECT: {self.project_name}"
        system_prompt += "\nCRITICAL INSTRUCTION: Never write JSON blocks or tool calls in the chat. Trigger function calls silently. Respond in plain text only after receiving the tool result."
        self.llm.clear_context(system_prompt)

    def process_command(self, user_input):
        if user_input.startswith("/"):
            self.cmd_manager.execute(user_input)
            return

        agent_color = "magenta" if self.active_agent == "architect" else "cyan"
        self.ui.console.print(f"\n[{agent_color}][bold]{self.active_agent.upper()} >[/bold] ", end="")

        tool_calls_to_execute = []
        status = self.ui.console.status(f"[{agent_color}]The {self.active_agent} is thinking...", spinner="dots")
        status.start()
        first_chunk = False

        try:
            for response in self.llm.chat_stream(user_input, tools=self.tool_manager.get_tools_definition()):
                if "error" in response:
                    status.stop()
                    self.ui.error(response["error"])
                    return

                if not first_chunk:
                    status.stop()
                    first_chunk = True

                if "chunk" in response:
                    self.ui.console.print(f"[{agent_color}]{response['chunk']}[/{agent_color}]", end="")

                if "tool_calls" in response:
                    tool_calls_to_execute = response["tool_calls"]
        finally:
            if not first_chunk:
                status.stop()

        self.ui.console.print()

        if tool_calls_to_execute:
            for tool_call in tool_calls_to_execute:
                tool_name = tool_call['function']['name']
                tool_args = tool_call['function']['arguments']

                self.ui.log_action("Tool", f"Executing {tool_name}...")
                result = self.tool_manager.execute_tool(tool_name, tool_args)

                self.ui.console.print(f"\n[{agent_color}][bold]{self.active_agent.upper()} >[/bold] ", end="")

                tool_status = self.ui.console.status(f"[{agent_color}]Processing tool result...", spinner="dots")
                tool_status.start()
                first_tool_chunk = False

                follow_up_msg = f"System Notification: Tool '{tool_name}' executed. Result: {result}"
                try:
                    for response in self.llm.chat_stream(user_message=follow_up_msg):
                        if not first_tool_chunk:
                            tool_status.stop()
                            first_tool_chunk = True

                        if "chunk" in response:
                            self.ui.console.print(f"[{agent_color}]{response['chunk']}[/{agent_color}]", end="")
                finally:
                    if not first_tool_chunk:
                        tool_status.stop()

                self.ui.console.print()

        self.ui.log_action("Context", f"{self.llm.total_tokens} tokens used in current memory")
