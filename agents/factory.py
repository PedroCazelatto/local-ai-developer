from pathlib import Path
from typing import List
from agents.base import Agent

class AgentFactory:
    _phases_dir = Path(__file__).resolve().parent.parent / "rules" / "phases"

    @classmethod
    def available_roles(cls) -> List[str]:
        return sorted(p.stem for p in cls._phases_dir.glob("*.md"))

    @classmethod
    def get_agent(cls, role: str) -> Agent:
        normalized = role.strip().lower()
        path = cls._phases_dir / f"{normalized}.md"
        if not path.exists():
            available = ", ".join(cls.available_roles())
            raise ValueError(f"Unknown phase: '{role}'. Available: {available}")
        persona = path.read_text(encoding="utf-8")
        return Agent(role=normalized, persona=persona)
