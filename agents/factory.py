from pathlib import Path
from typing import List
from agents.base import Agent

class AgentFactory:
    _personas_dir = Path(__file__).resolve().parent.parent / "rules" / "personas"

    @classmethod
    def available_roles(cls) -> List[str]:
        return sorted(p.stem for p in cls._personas_dir.glob("*.md"))

    @classmethod
    def get_agent(cls, role: str) -> Agent:
        normalized = role.strip().lower()
        path = cls._personas_dir / f"{normalized}.md"
        if not path.exists():
            available = ", ".join(cls.available_roles())
            raise ValueError(f"Unknown persona: '{role}'. Available: {available}")
        persona = path.read_text(encoding="utf-8")
        return Agent(role=normalized, persona=persona, tools=[])
