import ollama
from typing import List, Dict, Any
from .models import ChatMessage, ToolCall, ExecutionResult
from .docker_client import DockerManager
from .ui import ChatUI

class OrchestratorEngine:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self.ui = ChatUI()
        self.docker = DockerManager()
        self.history: List[Dict[str, Any]] = []

    def start(self) -> None:
        self.ui.log_action("ENGINE", f"Starting session with model {self.model_name}")

        while True:
            try:
                user_input = self.ui.console.input("\n[bold green]Prompt > [/]")
                if user_input.lower() in ["exit", "quit", "sair"]:
                    break

                self.history.append({"role": "user", "content": user_input})
                self._chat_cycle()
            except KeyboardInterrupt:
                break

    def _chat_cycle(self) -> None:
        with self.ui.display_status("AI is thinking"):
            response = ollama.chat(
                model=self.model_name,
                messages=self.history,
            )

        message_obj = response["message"]

        if hasattr(message_obj, "model_dump"):
            msg_dict = message_obj.model_dump()
        else:
            msg_dict = {
                "role": message_obj.role,
                "content": message_obj.content,
                "tool_calls": getattr(message_obj, "tool_calls", None)
            }

        self.history.append(msg_dict)

        msg_model = ChatMessage(**msg_dict)

        if msg_model.tool_calls:
            for call in msg_model.tool_calls:
                self._execute_tool(call)
            self._chat_cycle()
        else:
            self.ui.display_message(msg_model)

    def _execute_tool(self, call: ToolCall) -> None:
        name = call.function.name
        args = call.function.arguments

        self.ui.log_action("TOOL CALL", f"{name}({args})")

        if name == "execute_command":
            res: ExecutionResult = self.docker.execute(args.get("command", ""))
            self.history.append({
                "role": "tool",
                "name": name,
                "content": res.output if res.success else f"Error: {res.error}"
            })
