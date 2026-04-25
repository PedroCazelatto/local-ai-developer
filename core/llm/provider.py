import ollama
from collections.abc import Iterator
from typing import Any

class LLMProvider:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    def chat(self, messages: list[dict[str, Any]], tools: list[Any] | None = None) -> ollama.ChatResponse:
        return ollama.chat(
            model=self.model_name,
            messages=messages,
            tools=tools,
        )

    def stream(self, messages: list[dict[str, Any]], tools: list[Any] | None = None) -> Iterator[ollama.ChatResponse]:
        return ollama.chat(
            model=self.model_name,
            messages=messages,
            tools=tools,
            stream=True,
        )
