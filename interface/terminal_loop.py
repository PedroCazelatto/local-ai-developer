from typing import Iterator
from interface.command_processor import CommandProcessor
from core.ui.renderer import UIRenderer


class TerminalLoop:
    def __init__(self) -> None:
        self.processor = CommandProcessor()
        self.renderer = UIRenderer()

    def get_input(self, persona: str) -> str:
        style = self.renderer.theme.for_role(persona)
        label = persona.replace("_", " ").upper()
        return self.renderer.console.input(f"\n[{style}]{label}[/] [dim]›[/] ")

    def display_welcome(self, *, project: str, model: str, persona: str) -> None:
        self.renderer.display_welcome(project=project, model=model, persona=persona)

    def display_status(self, *, persona: str, project: str, model: str, memory_size: int) -> None:
        self.renderer.display_status(persona=persona, project=project, model=model, memory_size=memory_size)

    def display_system_info(self, message: str) -> None:
        self.renderer.display_chat("system", message)

    def display_error(self, message: str) -> None:
        self.renderer.display_error(message)

    def display_response(self, content: str, persona: str) -> None:
        self.renderer.display_chat("assistant", content, display_as=persona)

    def stream_response(self, chunks: Iterator[str], persona: str) -> str:
        return self.renderer.display_streaming_response(chunks, "assistant", display_as=persona)
