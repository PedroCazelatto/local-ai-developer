"""Strip tool-call mechanics from a streamed delta sequence so the UI shows
prose only. Detects two shapes:

- `<tool_call>...</tool_call>` tags.
- Bare top-level JSON objects whose keys include `name`, `function_name`,
  or `tool` (the qwen2.5-coder bare-emission patterns).

Non-tool-call JSON (e.g. a snippet the model quotes in prose) is held while
the braces balance, then emitted in one chunk. Lives in the same family as
`tool_call_recovery` — both compensate for Ollama's streaming tool-call gaps
on qwen2.5-coder.
"""
import json

_NAME_KEYS = ("name", "function_name", "tool")
_TAG_OPEN = "<tool_call>"
_TAG_CLOSE = "</tool_call>"


class StreamFilter:
    def __init__(self) -> None:
        self.mode: str = "prose"
        self.pending: str = ""
        self.depth: int = 0
        self.in_string: bool = False
        self.escape: bool = False

    def push(self, delta: str) -> str:
        out: list[str] = []
        for ch in delta:
            if self.mode == "prose":
                self._handle_prose(ch, out)
            elif self.mode == "tag":
                self.pending += ch
                if self.pending.endswith(_TAG_CLOSE):
                    self.pending = ""
                    self.mode = "prose"
            elif self.mode == "json":
                self.pending += ch
                self._advance_json(ch)
                if self.depth == 0:
                    self._close_json(out)
        return "".join(out)

    def flush(self) -> str:
        """End-of-stream tail. Returns any held prose; drops partial tool-call buffers."""
        if self.mode == "prose":
            out = self.pending
            self.pending = ""
            return out
        self.pending = ""
        self.mode = "prose"
        return ""

    def _handle_prose(self, ch: str, out: list[str]) -> None:
        if self.pending.startswith("<"):
            candidate = self.pending + ch
            if candidate == _TAG_OPEN:
                self.mode = "tag"
                self.pending = ""
                return
            if _TAG_OPEN.startswith(candidate):
                self.pending = candidate
                return
            out.append(self.pending)
            self.pending = ""
            self._handle_prose_fresh(ch, out)
            return
        self._handle_prose_fresh(ch, out)

    def _handle_prose_fresh(self, ch: str, out: list[str]) -> None:
        if ch == "<":
            self.pending = "<"
            return
        if ch == "{":
            self.mode = "json"
            self.pending = "{"
            self.depth = 1
            self.in_string = False
            self.escape = False
            return
        out.append(ch)

    def _advance_json(self, ch: str) -> None:
        if self.escape:
            self.escape = False
            return
        if self.in_string:
            if ch == "\\":
                self.escape = True
            elif ch == '"':
                self.in_string = False
            return
        if ch == '"':
            self.in_string = True
        elif ch == "{":
            self.depth += 1
        elif ch == "}":
            self.depth -= 1

    def _close_json(self, out: list[str]) -> None:
        try:
            obj = json.loads(self.pending)
            is_tool_call = isinstance(obj, dict) and any(k in obj for k in _NAME_KEYS)
        except json.JSONDecodeError:
            is_tool_call = False
        if not is_tool_call:
            out.append(self.pending)
        self.pending = ""
        self.mode = "prose"
