from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from .models import ChatMessage

class ChatUI:
    def __init__(self) -> None:
        self.console = Console()

    def display_message(self, message: ChatMessage) -> None:
        role = message.role.upper()
        content = message.content

        styles = {
            "USER": {"color": "green", "justify": "right"},
            "ASSISTANT": {"color": "cyan", "justify": "left"},
            "SYSTEM": {"color": "yellow", "justify": "center"},
            "TOOL": {"color": "magenta", "justify": "left"}
        }

        config = styles.get(role, {"color": "white", "justify": "left"})

        renderable = Markdown(content) if role == "ASSISTANT" else content

        panel = Panel(
            renderable,
            title=f"[bold {config['color']}]{role}[/]",
            border_style=config["color"],
            padding=(1, 2)
        )
        self.console.print(panel)

    def display_status(self, text: str):
        return self.console.status(f"[bold blue]{text}...[/]")

    def log_action(self, action: str, detail: str) -> None:
        self.console.print(f"[bold magenta]>> {action}:[/] [white]{detail}[/]")
