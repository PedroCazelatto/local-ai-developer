from .base import BaseAgent
from typing import List

class ArchitectAgent(BaseAgent):
    @property
    def persona(self) -> str:
        return "You are a Senior Software Architect. Your goal is to plan scalable systems and define engineering standards."

    @property
    def tools(self) -> List[str]:
        return ["list_files", "read_file"]
