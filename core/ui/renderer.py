from typing import Optional
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from core.ui.theme import UITheme


class UIRenderer:
    def __init__(self) -> None:
        self.console = Console()
        self.theme = UITheme()

    def display_chat(self, role: str, content: str, display_as: Optional[str] = None) -> None:
        label_role = display_as or role
        style = self.theme.for_role(label_role)
        is_markdown = role.lower() == "assistant"
        renderable = Markdown(content) if is_markdown else content
        panel = Panel(
            renderable,
            title=f"[{style}]{label_role.replace('_', ' ').upper()}[/]",
            border_style=style,
        )
        self.console.print(panel)

    def display_status(self, *, persona: str, project: str, model: str, memory_size: int) -> None:
        persona_style = self.theme.for_role(persona)
        persona_label = persona.replace("_", " ").upper()
        line = (
            f"[{persona_style}]{persona_label}[/]  "
            f"[dim]project: {project}  ·  model: {model}  ·  memory: {memory_size} msgs[/]"
        )
        self.console.rule(line, style=persona_style, align="left")

    def display_error(self, message: str) -> None:
        style = self.theme.for_role("error")
        self.console.print(f"[{style}]![/] {message}")

    def display_welcome(self, *, project: str, model: str, persona: str) -> None:
        persona_style = self.theme.for_role(persona)
        body = (
            "[bold]Local AI Developer[/]\n"
            f"[dim]Project:[/]  {project}\n"
            f"[dim]Model:[/]    {model}\n"
            f"[dim]Persona:[/]  [{persona_style}]{persona.replace('_', ' ').upper()}[/]\n"
            "[dim]Commands:[/] /swap <role>  ·  /clear  ·  /exit"
        )
        self.console.print(Panel(body, border_style="cyan"))
