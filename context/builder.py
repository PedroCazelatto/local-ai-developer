from context.rules import RulesLoader

class ContextBuilder:
    def __init__(self) -> None:
        self.loader = RulesLoader()

    def build_system_prompt(self, agent_persona: str, project_state: str) -> str:
        rules = self.loader.load_all()

        return f"""
        # ROLE
        {agent_persona}

        # PROJECT RULES AND STANDARDS
        {rules}

        # CURRENT PROJECT CONTEXT
        {project_state}
        """
