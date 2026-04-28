from collections.abc import Iterator

from rich.text import Text

from core.ui.renderer import UIRenderer


class TerminalLoop:
    def __init__(self) -> None:
        self.renderer = UIRenderer()

    def add_user_message(self, content: str) -> None:
        self.renderer.add_user(content)

    def add_assistant_message(self, content: str, persona: str) -> None:
        self.renderer.add_assistant(content, persona)

    def add_system_message(self, content: str) -> None:
        self.renderer.add_system(content)

    def clear_messages(self) -> None:
        self.renderer.clear_messages()

    def display_error(self, message: str) -> None:
        self.renderer.display_error(message)

    def build_status(
        self,
        *,
        persona: str,
        project: str,
        model: str,
        tokens_used: int,
        num_ctx: int,
    ) -> Text:
        return self.renderer.build_status(
            persona=persona,
            project=project,
            model=model,
            tokens_used=tokens_used,
            num_ctx=num_ctx,
        )

    def get_input(self, persona: str, status: Text) -> str:
        return self.renderer.get_input(persona, status)

    def stream_response(self, chunks: Iterator[str], persona: str, status: Text) -> str:
        return self.renderer.stream_response(chunks, persona, status)
