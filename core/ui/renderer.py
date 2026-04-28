from typing import Optional, TypedDict

from rich.console import Console, Group, RenderableType
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

from core.ui.theme import UITheme


class ChatMessage(TypedDict, total=False):
    role: str
    content: str
    persona: str


class UIRenderer:
    """Pure renderer — no state; fed by TerminalLoop on every refresh."""

    def __init__(self, console: Console) -> None:
        self.console = console
        self.theme = UITheme()

    def render_message(self, msg: ChatMessage) -> RenderableType:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            return Text(content, style="bright_white")
        if role == "assistant":
            persona = msg.get("persona", "assistant")
            shade = self.theme.shade_for_role(persona)
            return Markdown(content, style=shade)
        if role == "system":
            return Text(content, style="grey50 italic")
        return Text(content)

    def render_streaming(self, persona: str, content: str) -> RenderableType:
        """Plain Text during streaming — much cheaper to re-render than Markdown."""
        shade = self.theme.shade_for_role(persona)
        if content:
            return Text(content, style=shade)
        return Text("…", style=f"{shade} dim")

    def render_thinking(self, persona: str) -> RenderableType:
        shade = self.theme.shade_for_role(persona)
        return Text("Thinking…", style=f"{shade} italic")

    def measure_height(self, renderable: RenderableType, width: int) -> int:
        if width <= 0:
            return 0
        options = self.console.options.update(width=width, height=None)
        lines = self.console.render_lines(renderable, options, new_lines=False)
        return len(lines)

    def build_history_panel(
        self,
        persona: str,
        messages: list[ChatMessage],
        *,
        avail_height: int,
        avail_width: int,
        streaming: Optional[str] = None,
        thinking: bool = False,
    ) -> Panel:
        candidates: list[RenderableType] = []
        for i, m in enumerate(messages):
            if i > 0:
                candidates.append(Text(""))
            candidates.append(self.render_message(m))

        if streaming is not None:
            if candidates:
                candidates.append(Text(""))
            candidates.append(self.render_streaming(persona, streaming))
        elif thinking:
            if candidates:
                candidates.append(Text(""))
            candidates.append(self.render_thinking(persona))

        kept: list[RenderableType] = []
        used = 0
        for r in reversed(candidates):
            h = self.measure_height(r, avail_width)
            if used + h > avail_height and kept:
                break
            kept.insert(0, r)
            used += h
            if used >= avail_height:
                break

        body: RenderableType = Group(*kept) if kept else Text("")
        title_style = self.theme.for_role(persona)
        title = persona.replace("_", " ").upper()
        return Panel(
            body,
            title=f"[{title_style}]{title}[/]",
            title_align="center",
            border_style=title_style,
            padding=(0, 1),
        )

    def build_input_line(
        self,
        *,
        persona: str,
        buffer: str,
        cursor_pos: int,
        is_streaming: bool,
        queued: int,
    ) -> Text:
        prompt_style = self.theme.for_role(persona)
        text = Text(no_wrap=False, overflow="ellipsis")
        text.append("› ", style=prompt_style)
        text.append(buffer[:cursor_pos], style="bright_white")
        text.append("▎", style="bright_white reverse")
        text.append(buffer[cursor_pos:], style="bright_white")
        if queued > 0:
            text.append(f"   [{queued} queued]", style="dim italic")
        elif is_streaming:
            text.append("   [generating…]", style="dim italic")
        return text

    def build_status_line(
        self,
        *,
        project: str,
        model: str,
        tokens_used: int,
        num_ctx: int,
    ) -> Text:
        pct = (tokens_used / num_ctx * 100) if num_ctx > 0 else 0.0
        line = Text(overflow="ellipsis", no_wrap=True)
        line.append(f"project: {project}", style="dim")
        line.append("  ·  ", style="dim")
        line.append(f"model: {model}", style="dim")
        line.append("  ·  ", style="dim")
        line.append(f"ctx: {tokens_used}/{num_ctx} ({pct:.1f}%)", style="dim")
        return line
