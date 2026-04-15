from typing import List, Dict, Any, Optional

class SessionMemory:
    def __init__(self) -> None:
        self.history: List[Dict[str, Any]] = []

    def add(self, role: str, content: str, name: Optional[str] = None) -> None:
        entry = {"role": role, "content": content}
        if name:
            entry["name"] = name
        self.history.append(entry)

    def clear(self) -> None:
        self.history = []
