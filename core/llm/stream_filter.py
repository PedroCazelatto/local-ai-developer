"""Strip tool-call mechanics from a streamed delta sequence so the UI shows
prose only. Detects three shapes:

- `<tool_call>...</tool_call>` tags.
- Bare top-level JSON objects whose keys include `name`, `function_name`,
  or `tool` (the qwen2.5-coder bare-emission patterns).
- The same JSON wrapped in a markdown fence (```json ... ```), fence included.

Non-tool-call JSON (e.g. a snippet the model quotes in prose) is held while
the braces balance, then emitted in one chunk; the same goes for fenced JSON.
Lives in the same family as `tool_call_recovery` — both compensate for
Ollama's streaming tool-call gaps on qwen2.5-coder.
"""
from core.llm.json_repair import loads_or_repair

_NAME_KEYS = ("name", "function_name", "tool")
_TAG_OPEN = "<tool_call>"
_TAG_CLOSE = "</tool_call>"
_FENCE_LANG_CHARS = "_-+."
_WHITESPACE = " \t\r\n"


class StreamFilter:
    def __init__(self) -> None:
        self.mode: str = "prose"
        self.pending: str = ""
        self.depth: int = 0
        self.in_string: bool = False
        self.escape: bool = False
        self.json_start: int = 0
        self.json_end: int = 0

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
            elif self.mode == "fence_open":
                self._handle_fence_open(ch, out)
            elif self.mode == "fence_body":
                self._handle_fence_body(ch, out)
            elif self.mode == "fence_json":
                self.pending += ch
                self._advance_json(ch)
                if self.depth == 0:
                    self.json_end = len(self.pending)
                    self.mode = "fence_close"
            elif self.mode == "fence_close":
                self._handle_fence_close(ch, out)
        return "".join(out)

    def flush(self) -> str:
        """End-of-stream tail. Returns any held prose; drops partial tool-call
        buffers. A complete fenced JSON that is NOT a tool call is returned."""
        pending, mode = self.pending, self.mode
        self.pending = ""
        self.mode = "prose"
        if mode == "prose":
            return pending
        if mode == "fence_close" and not self._is_tool_call(pending[self.json_start:self.json_end]):
            return pending
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
            self._reset_json_tracking()
            return
        if ch == "`":
            self.mode = "fence_open"
            self.pending = "`"
            return
        out.append(ch)

    # ---------------------------------------------------------------- fences

    def _handle_fence_open(self, ch: str, out: list[str]) -> None:
        """Accumulating ``` + optional language tag, until the newline."""
        only_ticks = not self.pending.strip("`")
        if ch == "`":
            if only_ticks and len(self.pending) < 3:
                self.pending += ch
                return
            self._abort_fence(ch, out)
            return
        if only_ticks and len(self.pending) < 3:
            self._abort_fence(ch, out)  # one or two backticks: inline code, not a fence
            return
        if ch == "\n":
            self.pending += ch
            self.mode = "fence_body"
            return
        if ch.isalnum() or ch in _FENCE_LANG_CHARS:
            self.pending += ch
            return
        self._abort_fence(ch, out)

    def _handle_fence_body(self, ch: str, out: list[str]) -> None:
        """Inside the fence, before the first non-whitespace character."""
        if ch in _WHITESPACE:
            self.pending += ch
            return
        if ch == "{":
            self.json_start = len(self.pending)
            self.pending += ch
            self._reset_json_tracking()
            self.mode = "fence_json"
            return
        self._abort_fence(ch, out)  # fence body isn't JSON — stream it normally

    def _handle_fence_close(self, ch: str, out: list[str]) -> None:
        """JSON balanced; expecting optional whitespace then the closing ```."""
        if ch in _WHITESPACE and not self.pending.endswith("`"):
            self.pending += ch
            return
        if ch == "`":
            self.pending += ch
            if self.pending.endswith("```"):
                if not self._is_tool_call(self.pending[self.json_start:self.json_end]):
                    out.append(self.pending)
                self.pending = ""
                self.mode = "prose"
            return
        self._abort_fence(ch, out)

    def _abort_fence(self, ch: str, out: list[str]) -> None:
        """Held text turned out not to be a tool-call fence: emit and resume prose."""
        out.append(self.pending)
        self.pending = ""
        self.mode = "prose"
        self._handle_prose_fresh(ch, out)

    # ------------------------------------------------------------------ json

    def _reset_json_tracking(self) -> None:
        self.depth = 1
        self.in_string = False
        self.escape = False

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
        if not self._is_tool_call(self.pending):
            out.append(self.pending)
        self.pending = ""
        self.mode = "prose"

    @staticmethod
    def _is_tool_call(text: str) -> bool:
        obj = loads_or_repair(text)
        return isinstance(obj, dict) and any(k in obj for k in _NAME_KEYS)
