class ContextBuilder:
    def build_system_prompt(self, agent_persona: str, project_state: str) -> str:
        return (
            f"{agent_persona}\n\n"
            f"# Project Context\n"
            f"{project_state}\n"
        )
