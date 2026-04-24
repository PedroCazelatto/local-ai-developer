from typing import List, Optional


class Agent:
    def __init__(self, role: str, persona: str, tools: Optional[List[str]] = None) -> None:
        self.role = role
        self.persona = persona
        self.tools = tools or []
