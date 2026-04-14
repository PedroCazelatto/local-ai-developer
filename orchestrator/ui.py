from rich.console import Console
from rich.panel import Panel

console = Console()

class UI:
    def display_message(self, role, content):
        colors = {"system": "blue", "ai": "green", "user": "white", "architect": "magenta", "dev": "cyan"}
        color = colors.get(role, "white")
        console.print(Panel(content, title=role.upper(), border_style=color))

    def log_action(self, action_name, details):
        console.print(f"[bold yellow]⚙️ EXECUTION:[/bold yellow] {action_name} - {details}")

    def error(self, message):
        console.print(f"[bold red]❌ ERROR:[/bold red] {message}")

    def show_agent_status(self, agent_name):
        console.rule(f"[bold magenta]🔄 Active Agent Switched: {agent_name.upper()}[/bold magenta]")
