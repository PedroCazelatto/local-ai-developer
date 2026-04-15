from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from core.ui.theme import UITheme

class UIRenderer:
    def __init__(self) -> None:
        self.console = Console()
        self.theme = UITheme()

    def display_chat(self, role: str, content: str) -> None:
        style = self.theme.styles.get(role.lower(), "white")
        renderable = Markdown(content) if role.lower() == "assistant" else content

        panel = Panel(
            renderable,
            title=f"[{style}]{role.upper()}[/]",
            border_style=style
        )
        self.console.print(panel)
