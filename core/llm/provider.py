import ollama
from collections.abc import Iterator
from typing import Any

class LLMProvider:
    def __init__(self, model_name: str, num_ctx: int) -> None:
        self.model_name = model_name
        self.num_ctx = num_ctx

    def chat(self, messages: list[dict[str, Any]], tools: list[Any] | None = None) -> ollama.ChatResponse:
        return ollama.chat(
            model=self.model_name,
            messages=messages,
            tools=tools,
            options={"num_ctx": self.num_ctx},
        )

    def stream(self, messages: list[dict[str, Any]], tools: list[Any] | None = None) -> Iterator[ollama.ChatResponse]:
        return ollama.chat(
            model=self.model_name,
            messages=messages,
            tools=tools,
            stream=True,
            options={"num_ctx": self.num_ctx},
        )
