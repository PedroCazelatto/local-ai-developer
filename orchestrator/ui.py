from rich.console import Console
from rich.panel import Panel
from rich.live import Live

console = Console()

class UI:
    def display_message(self, role, content):
        color = "blue" if role == "user" else "green"
        console.print(Panel(content, title=role.upper(), border_style=color))

    def log_action(self, action_name, details):
        console.print(f"[bold yellow]⚙️ EXECUTION:[/bold yellow] {action_name} - {details}")

    def error(self, message):
        console.print(f"[bold red]❌ ERROR:[/bold red] {message}")
