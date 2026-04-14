from orchestrator.ui import UI
from orchestrator.llm_client import LLMClient
from orchestrator.context_builder import ContextBuilder
from orchestrator.tool_manager import ToolManager

class Orchestrator:
    def __init__(self, project_name, project_path):
        self.project_name = project_name
        self.project_path = project_path
        self.active_agent = "architect"

        self.ui = UI()
        self.llm = LLMClient()
        self.context_builder = ContextBuilder()

        self.tool_manager = ToolManager(project_path)

    def start(self):
        self.ui.display_message("system", f"Project Context: {self.project_name}")
        self.ui.log_action("Model Loaded", self.llm.model)
        self.switch_agent(self.active_agent)

    def switch_agent(self, agent_name):
        self.active_agent = agent_name
        self.ui.show_agent_status(agent_name)

        new_system_prompt = self.context_builder.build_prompt(agent_name)
        self.llm.clear_context(new_system_prompt)

    def process_command(self, user_input):
        if user_input.startswith("/switch"):
            parts = user_input.split(" ")
            if len(parts) > 1 and parts[1] in ["architect", "dev"]:
                self.switch_agent(parts[1])
            else:
                self.ui.error("Usage: /switch architect OR /switch dev")
            return

        if user_input == "/clear":
            self.switch_agent(self.active_agent)
            self.ui.display_message("system", "Context cleared.")
            return

        self.ui.display_message("user", user_input)

        response = self.llm.chat(user_input, tools=self.tool_manager.get_tools_definition())

        if response.get('tool_calls'):
            for tool_call in response['tool_calls']:
                tool_name = tool_call['function']['name']
                tool_args = tool_call['function']['arguments']

                self.ui.log_action("Executing Tool", f"{tool_name}")

                result = self.tool_manager.execute_tool(tool_name, tool_args)
                self.ui.log_action("Tool Result", result)

                follow_up_response = self.llm.chat(
                    user_message=f"System Notification: Tool '{tool_name}' executed. Result:\n{result}"
                )
                self.ui.display_message(self.active_agent, follow_up_response.get('content', 'Done.'))
        elif response.get('content'):
            self.ui.display_message(self.active_agent, response.get('content'))
