import sys
from collections.abc import Iterator
from typing import Optional, TypedDict

from rich.align import Align
from rich.console import Console, Group, RenderableType
from rich.control import Control
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

from core.ui.theme import UITheme


class ChatMessage(TypedDict, total=False):
    role: str
    content: str
    persona: str


# Lines reserved below the history panel:
#   1 input line, 1 status line, 1 trailing safety margin
RESERVED_BOTTOM_LINES = 3


class UIRenderer:
    def __init__(self) -> None:
        self.console = Console()
        self.theme = UITheme()
        self.messages: list[ChatMessage] = []

    def add_user(self, content: str) -> None:
        self.messages.append({"role": "user", "content": content})

    def add_assistant(self, content: str, persona: str) -> None:
        self.messages.append({"role": "assistant", "content": content, "persona": persona})

    def add_system(self, content: str) -> None:
        self.messages.append({"role": "system", "content": content})

    def clear_messages(self) -> None:
        self.messages.clear()

    def _render_message(self, msg: ChatMessage) -> RenderableType:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            label = Text("YOU", style="bright_white bold")
            body = Text(content, style="bright_white")
            return Group(label, body, Text(""))
        if role == "assistant":
            persona = msg.get("persona", "assistant")
            label_style = self.theme.for_role(persona)
            shade = self.theme.shade_for_role(persona)
            label = Text(persona.replace("_", " ").upper(), style=label_style)
            body = Markdown(content, style=shade)
            return Group(label, body, Text(""))
        if role == "system":
            return Group(Text(content, style="grey50 italic"), Text(""))
        return Group(Text(content), Text(""))

    def _build_history_panel(
        self,
        persona: str,
        *,
        streaming: Optional[str] = None,
        thinking: bool = False,
    ) -> Panel:
        items: list[RenderableType] = [self._render_message(m) for m in self.messages]

        if streaming is not None:
            label_style = self.theme.for_role(persona)
            shade = self.theme.shade_for_role(persona)
            label = Text(persona.replace("_", " ").upper(), style=label_style)
            body = Markdown(streaming, style=shade) if streaming else Text("…", style=f"{shade} dim")
            items.append(Group(label, body, Text("")))
        elif thinking:
            label_style = self.theme.for_role(persona)
            shade = self.theme.shade_for_role(persona)
            label = Text(persona.replace("_", " ").upper(), style=label_style)
            body = Text("Thinking…", style=f"{shade} italic")
            items.append(Group(label, body, Text("")))

        body_group: RenderableType = Group(*items) if items else Text("")
        # Bottom-anchor so the most recent messages stay in view as history grows.
        anchored = Align(body_group, align="left", vertical="bottom")

        height = max(self.console.size.height - RESERVED_BOTTOM_LINES, 5)
        title_style = self.theme.for_role(persona)
        title = persona.replace("_", " ").upper()
        return Panel(
            anchored,
            title=f"[{title_style}]{title}[/]",
            title_align="center",
            border_style=title_style,
            height=height,
            padding=(0, 1),
        )

    def build_status(
        self,
        *,
        persona: str,
        project: str,
        model: str,
        tokens_used: int,
        num_ctx: int,
    ) -> Text:
        pct = (tokens_used / num_ctx * 100) if num_ctx > 0 else 0.0
        line = Text()
        line.append(persona.replace("_", " ").upper(), style=self.theme.for_role(persona))
        line.append("  ·  ", style="dim")
        line.append(f"project: {project}", style="dim")
        line.append("  ·  ", style="dim")
        line.append(f"model: {model}", style="dim")
        line.append("  ·  ", style="dim")
        line.append(f"ctx: {tokens_used}/{num_ctx} ({pct:.1f}%)", style="dim")
        return line

    def get_input(self, persona: str, status: Text) -> str:
        """Render the screen and prompt for input. Status is shown one line below the input."""
        self.console.clear()
        self.console.print(self._build_history_panel(persona))
        # Reserve the input line + render the status line below it, then move the
        # cursor back up onto the input line so the user types in the right place.
        self.console.print()
        self.console.print(status)
        self.console.control(Control.move(0, -2), Control.move_to_column(0))
        prompt_style = self.theme.for_role(persona)
        return self.console.input(f"[{prompt_style}]›[/] ")

    def stream_response(
        self,
        chunks: Iterator[str],
        persona: str,
        status: Text,
    ) -> str:
        """Stream a response into the panel; show 'Thinking…' until the first token arrives."""
        self.console.clear()

        def _frame(streaming_text: Optional[str], thinking: bool) -> Group:
            panel = self._build_history_panel(persona, streaming=streaming_text, thinking=thinking)
            indicator = Text("generating…", style="dim italic") if not thinking else Text("")
            return Group(panel, indicator, status)

        content = ""
        first_token = False
        with Live(
            _frame(None, thinking=True),
            console=self.console,
            refresh_per_second=15,
            transient=False,
        ) as live:
            for delta in chunks:
                content += delta
                if not first_token:
                    first_token = True
                live.update(_frame(content, thinking=False))

        sys.stdout.write("\a")
        sys.stdout.flush()
        return content

    def display_error(self, message: str) -> None:
        self.add_system(f"! {message}")
