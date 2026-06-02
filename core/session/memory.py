from typing import Any, Dict, List, Optional

class SessionMemory:
    def __init__(self) -> None:
        self._histories: Dict[str, List[Dict[str, Any]]] = {}
        self._active: Optional[str] = None

    def set_active_persona(self, persona: str) -> None:
        self._active = persona
        self._histories.setdefault(persona, [])

    def add(
        self,
        role: str,
        content: str,
        name: Optional[str] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        if self._active is None:
            raise RuntimeError("No active persona set")
        entry: Dict[str, Any] = {"role": role, "content": content}
        if name:
            entry["name"] = name
        if tool_calls:
            entry["tool_calls"] = tool_calls
        self._histories[self._active].append(entry)

    def clear(self) -> None:
        if self._active is not None:
            self._histories[self._active] = []

    @property
    def history(self) -> List[Dict[str, Any]]:
        if self._active is None:
            return []
        return self._histories[self._active]
