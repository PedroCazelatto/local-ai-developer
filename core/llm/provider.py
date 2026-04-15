import ollama
from typing import List, Dict, Any, Optional

class LLMProvider:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Any]] = None) -> Any:
        return ollama.chat(
            model=self.model_name,
            messages=messages,
            tools=tools
        )
