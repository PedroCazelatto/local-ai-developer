from typing import Optional, TypedDict

from rich import box
from rich.console import Console, Group, RenderableType
from rich.markdown import Markdown
from rich.panel import Panel
from rich.rule import Rule
from rich.segment import Segment, Segments
from rich.text import Text

from core.ui.theme import UITheme


class ChatMessage(TypedDict, total=False):
    role: str
    content: str
    persona: str
    queued: bool


def _line_is_blank(line: list[Segment]) -> bool:
    return all(not seg.text.strip() for seg in line)


def _lines_to_renderable(lines: list[list[Segment]]) -> Segments:
    flat: list[Segment] = []
    for i, line in enumerate(lines):
        if i > 0:
            flat.append(Segment.line())
        flat.extend(line)
    return Segments(flat, new_lines=False)


class UIRenderer:
    """Pure renderer — no state; fed by TerminalLoop on every refresh."""

    def __init__(self, console: Console) -> None:
        self.console = console
        self.theme = UITheme()

    def render_message(self, msg: ChatMessage) -> RenderableType:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            if msg.get("queued"):
                text = Text(no_wrap=False)
                text.append("[queued] ", style="bright_black italic")
                text.append(content, style="bright_white dim")
                return text
            return Text(content, style="bright_white")
        if role == "assistant":
            persona = msg.get("persona", "assistant")
            shade = self.theme.shade_for_role(persona)
            return Markdown(content, style=shade)
        if role == "system":
            return Text(content, style="grey50 italic")
        return Text(content)

    def render_streaming(self, persona: str, content: str) -> RenderableType:
        shade = self.theme.shade_for_role(persona)
        if content:
            return Text(content, style=shade)
        return Text("…", style=f"{shade} dim")

    def render_thinking(self, persona: str) -> RenderableType:
        shade = self.theme.shade_for_role(persona)
        return Text("Thinking…", style=f"{shade} italic")

    def build_history_panel(
        self,
        persona: str,
        messages: list[ChatMessage],
        *,
        avail_height: int,
        avail_width: int,
        streaming: Optional[str] = None,
        thinking: bool = False,
        scroll_offset: int = 0,
    ) -> tuple[RenderableType, int, int]:
        """Returns (renderable, total_lines, clamped_scroll_offset).

        Renders a borderless history: a left-aligned persona Rule on top, then
        the message body. clamped_scroll_offset lets the caller correct an
        out-of-range scroll position after content shrinks or grows.
        """
        is_active = streaming is not None or thinking
        if is_active:
            non_queued = [m for m in messages if not m.get("queued")]
            queued = [m for m in messages if m.get("queued")]
        else:
            non_queued = list(messages)
            queued = []

        candidates: list[RenderableType] = []
        for i, m in enumerate(non_queued):
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

        for m in queued:
            if candidates:
                candidates.append(Text(""))
            candidates.append(self.render_message(m))

        options = self.console.options.update(width=avail_width, height=None)
        all_lines: list[list[Segment]] = []
        for r in candidates:
            all_lines.extend(self.console.render_lines(r, options, new_lines=False))

        total = len(all_lines)
        max_offset = max(0, total - avail_height)
        offset = min(max(scroll_offset, 0), max_offset)

        if total <= avail_height:
            visible = all_lines
        else:
            bottom_idx = total - offset
            top_idx = bottom_idx - avail_height
            visible = all_lines[top_idx:bottom_idx]

        # Trim a leading blank line so a slice that lands on a separator does
        # not leave dead space at the top of the box.
        while visible and _line_is_blank(visible[0]):
            visible.pop(0)

        body: RenderableType = _lines_to_renderable(visible) if visible else Text("")

        title_style = self.theme.for_role(persona)
        title_label = persona.replace("_", " ").upper()
        if offset > 0:
            title_label = f"{title_label}  ↑ {offset}"

        header = Rule(
            Text(f" {title_label} ", style=title_style),
            align="left",
            style="grey50",
        )
        return Group(header, body), total, offset

    def build_input_line(
        self,
        *,
        persona: str,
        buffer: str,
        cursor_pos: int,
    ) -> RenderableType:
        prompt_style = self.theme.for_role(persona)
        text = Text(no_wrap=False, overflow="ellipsis")
        text.append("› ", style=prompt_style)
        text.append(buffer[:cursor_pos], style="bright_white")
        text.append("▎", style="bright_white reverse")
        text.append(buffer[cursor_pos:], style="bright_white")
        return Panel(
            text,
            box=box.HORIZONTALS,
            border_style="grey50",
            padding=(0, 1),
        )

    def build_status_line(
        self,
        *,
        project: str,
        model: str,
        tokens_used: int,
        num_ctx: int,
        is_streaming: bool,
        queued: int,
    ) -> RenderableType:
        pct = (tokens_used / num_ctx * 100) if num_ctx > 0 else 0.0

        project_line = Text(no_wrap=True, overflow="ellipsis")
        project_line.append("Project: ", style="yellow")
        project_line.append(project, style="bright_yellow bold")

        model_line = Text(no_wrap=True, overflow="ellipsis")
        model_line.append(model, style="bright_green bold")
        model_line.append("  |  ", style="green")
        model_line.append(f"Ctx: {pct:.1f}%", style="green")

        if is_streaming and queued > 0:
            hint_text = f"generating…  ({queued} queued)"
        elif is_streaming:
            hint_text = "generating…"
        else:
            hint_text = "/swap <name> to change persona"
        hint_line = Text(no_wrap=True, overflow="ellipsis")
        hint_line.append("›› ", style="bright_yellow bold")
        hint_line.append(hint_text, style="yellow")

        return Group(Text(""), project_line, model_line, hint_line)
