from agents.architect import ArchitectAgent
from agents.developer import DeveloperAgent

class AgentFactory:
    @staticmethod
    def get_agent(role: str):
        agents = {
            "architect": ArchitectAgent(),
            "developer": DeveloperAgent()
        }
        return agents.get(role.lower(), ArchitectAgent())
