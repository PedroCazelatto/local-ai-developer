from .base import BaseAgent
from typing import List

class DeveloperAgent(BaseAgent):
    @property
    def persona(self) -> str:
        return "You are a Senior Fullstack Developer. You implement features, fix bugs, and execute commands via tools."

    @property
    def tools(self) -> List[str]:
        return ["list_files", "read_file", "alter_file", "execute_command"]
