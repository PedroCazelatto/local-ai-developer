from rich.console import Console

class UI:
    def __init__(self):
        self.console = Console()

    def display_message(self, role, content):
        colors = {
            "system": "blue",
            "user": "bright_white",
            "architect": "magenta",
            "dev": "cyan",
            "ai": "green"
        }
        color = colors.get(role, "white")

        role_label = f"[{color}][bold]{role.upper()}>[/bold][/{color}]"
        self.console.print(f"{role_label} {content}")

    def log_action(self, action_name, details):
        self.console.print(f"[dim yellow] {action_name}: {details}[/dim yellow]")

    def error(self, message):
        self.console.print(f"[bold red]❌ ERRO:[/bold red] {message}")

    def show_agent_status(self, agent_name):
        self.console.print(f"\n[bold reverse {agent_name}] ATIVO: {agent_name.upper()} [/bold reverse {agent_name}]\n")
