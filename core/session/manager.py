from .state import SessionState

class SessionManager:
    def __init__(self, project_name: str) -> None:
        self.state = SessionState(project_name=project_name)

    def update_agent(self, agent_name: str) -> None:
        self.state.current_agent = agent_name

    def add_message(self, role: str, content: str) -> None:
        self.state.history.append({"role": role, "content": content})
