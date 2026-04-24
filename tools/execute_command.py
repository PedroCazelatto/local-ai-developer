from tools.base import BaseTool
from core.container.client import DockerClient
from typing import Dict, Any

class ExecuteCommandTool(BaseTool):
    def __init__(self, project_path: str):
        self.docker = DockerClient(container_name="ai_sandbox")

    @property
    def definition(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "execute_command",
                "description": "Runs a shell command inside the project container.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "The command to run"}
                    },
                    "required": ["command"]
                }
            }
        }

    def execute(self, command: str) -> str:
        result = self.docker.execute_command(command)
        return f"STDOUT: {result['stdout']}\nSTDERR: {result['stderr']}"
