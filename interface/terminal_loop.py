import sys
import threading
import time
from collections.abc import Callable
from typing import Optional

from rich.console import Console
from rich.layout import Layout
from rich.live import Live

from core.ui.renderer import ChatMessage, UIRenderer

if sys.platform == "win32":
    import msvcrt
else:  # pragma: no cover - Windows-first per CLAUDE.md
    msvcrt = None  # type: ignore[assignment]


REFRESH_PER_SECOND = 12
INPUT_POLL_INTERVAL = 0.02


class TerminalLoop:
    """Full-screen TUI: locked terminal scroll, live history panel, non-blocking input with queueing."""

    def __init__(
        self,
        *,
        persona: str,
        project: str,
        model: str,
        num_ctx: int,
    ) -> None:
        self.console = Console()
        self.renderer = UIRenderer(self.console)

        self._persona = persona
        self._project = project
        self._model = model
        self._num_ctx = num_ctx
        self._tokens_used = 0

        self._messages: list[ChatMessage] = []
        self._streaming_content = ""
        self._is_streaming = False
        self._thinking = False

        self._buffer = ""
        self._cursor = 0

        self._lock = threading.Lock()
        self._work_cv = threading.Condition(self._lock)
        self._work_items: list[str] = []
        self._exit_requested = False

        self._layout = Layout()
        self._layout.split_column(
            Layout(name="history", ratio=1),
            Layout(name="input", size=1),
            Layout(name="status", size=1),
        )

    # ------------------------------------------------------------------ state mutators

    def set_persona(self, persona: str) -> None:
        with self._lock:
            self._persona = persona

    def update_tokens(self, tokens_used: int) -> None:
        with self._lock:
            self._tokens_used = tokens_used

    def add_user_message(self, content: str) -> None:
        with self._lock:
            self._messages.append({"role": "user", "content": content})

    def add_system_message(self, content: str) -> None:
        with self._lock:
            self._messages.append({"role": "system", "content": content})

    def clear_messages(self) -> None:
        with self._lock:
            self._messages.clear()

    def begin_stream(self) -> None:
        with self._lock:
            self._is_streaming = True
            self._thinking = True
            self._streaming_content = ""

    def append_stream_delta(self, delta: str) -> None:
        if not delta:
            return
        with self._lock:
            self._streaming_content += delta
            self._thinking = False

    def finalize_stream_as_assistant(self, persona: str) -> str:
        with self._lock:
            content = self._streaming_content
            if content:
                self._messages.append({"role": "assistant", "content": content, "persona": persona})
            self._is_streaming = False
            self._thinking = False
            self._streaming_content = ""
        return content

    def cancel_stream(self) -> None:
        with self._lock:
            self._is_streaming = False
            self._thinking = False
            self._streaming_content = ""

    def request_exit(self) -> None:
        with self._work_cv:
            self._exit_requested = True
            self._work_cv.notify_all()

    # ------------------------------------------------------------------ input queue

    def _submit_buffer(self) -> None:
        with self._work_cv:
            text = self._buffer
            self._buffer = ""
            self._cursor = 0
            stripped = text.strip()
            if not stripped:
                return
            self._work_items.append(text)
            if not stripped.startswith("/"):
                self._messages.append({"role": "user", "content": text})
            self._work_cv.notify()

    def _take_next_batch(self) -> list[str]:
        with self._work_cv:
            while not self._work_items and not self._exit_requested:
                self._work_cv.wait()
            if self._exit_requested and not self._work_items:
                return []
            first = self._work_items.pop(0)
            stripped = first.strip()
            if stripped.startswith("/"):
                return [first]
            batch = [first]
            while self._work_items:
                nxt = self._work_items[0]
                if nxt.strip().startswith("/"):
                    break
                batch.append(self._work_items.pop(0))
            return batch

    # ------------------------------------------------------------------ rendering

    def _refresh_layout(self) -> None:
        with self._lock:
            persona = self._persona
            messages = list(self._messages)
            streaming = self._streaming_content if self._is_streaming else None
            thinking = self._thinking
            is_streaming = self._is_streaming
            buffer = self._buffer
            cursor = self._cursor
            tokens_used = self._tokens_used
            queued = self._queued_count_locked()

        cols = self.console.size.width
        rows = self.console.size.height
        history_height = max(rows - 2, 4)
        avail_height = max(history_height - 2, 1)  # panel border (top + bottom)
        avail_width = max(cols - 4, 10)  # panel border + padding

        history_panel = self.renderer.build_history_panel(
            persona,
            messages,
            avail_height=avail_height,
            avail_width=avail_width,
            streaming=streaming if is_streaming else None,
            thinking=thinking and is_streaming,
        )
        input_line = self.renderer.build_input_line(
            persona=persona,
            buffer=buffer,
            cursor_pos=cursor,
            is_streaming=is_streaming,
            queued=queued,
        )
        status_line = self.renderer.build_status_line(
            project=self._project,
            model=self._model,
            tokens_used=tokens_used,
            num_ctx=self._num_ctx,
        )

        self._layout["history"].update(history_panel)
        self._layout["input"].update(input_line)
        self._layout["status"].update(status_line)

    def _queued_count_locked(self) -> int:
        # Count items still in the queue that look like user messages while a stream is active.
        if not self._is_streaming:
            return 0
        return sum(1 for x in self._work_items if not x.strip().startswith("/"))

    # ------------------------------------------------------------------ input handling

    def _read_key(self) -> Optional[str]:
        if msvcrt is None or not msvcrt.kbhit():
            return None
        return msvcrt.getwch()

    def _handle_key(self, key: str) -> None:
        if key in ("\r", "\n"):
            self._submit_buffer()
            return
        if key == "\x03":  # Ctrl+C
            self.request_exit()
            return
        if key == "\x04":  # Ctrl+D
            self.request_exit()
            return
        if key == "\x08":  # Backspace
            with self._lock:
                if self._cursor > 0:
                    self._buffer = self._buffer[: self._cursor - 1] + self._buffer[self._cursor :]
                    self._cursor -= 1
            return
        if key in ("\x00", "\xe0"):  # Windows extended-key prefix
            ext = msvcrt.getwch() if msvcrt and msvcrt.kbhit() else ""
            with self._lock:
                if ext == "K" and self._cursor > 0:  # Left
                    self._cursor -= 1
                elif ext == "M" and self._cursor < len(self._buffer):  # Right
                    self._cursor += 1
                elif ext == "G":  # Home
                    self._cursor = 0
                elif ext == "O":  # End
                    self._cursor = len(self._buffer)
                elif ext == "S" and self._cursor < len(self._buffer):  # Delete
                    self._buffer = self._buffer[: self._cursor] + self._buffer[self._cursor + 1 :]
            return
        if key == "\x15":  # Ctrl+U: clear line
            with self._lock:
                self._buffer = ""
                self._cursor = 0
            return
        if key == "\x17":  # Ctrl+W: delete word backwards
            with self._lock:
                left = self._buffer[: self._cursor].rstrip()
                space = left.rfind(" ")
                cut = space + 1 if space >= 0 else 0
                self._buffer = self._buffer[:cut] + self._buffer[self._cursor :]
                self._cursor = cut
            return
        if not key or ord(key) < 32:
            return
        with self._lock:
            self._buffer = self._buffer[: self._cursor] + key + self._buffer[self._cursor :]
            self._cursor += 1

    # ------------------------------------------------------------------ run

    def run(self, handler: Callable[[list[str]], None]) -> None:
        worker = threading.Thread(target=self._worker, args=(handler,), daemon=True)
        worker.start()

        try:
            with Live(
                self._layout,
                console=self.console,
                screen=True,
                refresh_per_second=REFRESH_PER_SECOND,
                transient=False,
            ) as live:
                while not self._exit_requested:
                    key = self._read_key()
                    if key is not None:
                        self._handle_key(key)
                    self._refresh_layout()
                    live.refresh()
                    if key is None:
                        time.sleep(INPUT_POLL_INTERVAL)
        finally:
            self.request_exit()
            worker.join(timeout=1.0)

    def _worker(self, handler: Callable[[list[str]], None]) -> None:
        while True:
            batch = self._take_next_batch()
            if not batch:
                return
            try:
                handler(batch)
            except Exception as exc:  # noqa: BLE001 - surface to UI
                self.add_system_message(f"error: {exc}")

    # ------------------------------------------------------------------ accessors for handler

    @property
    def persona(self) -> str:
        with self._lock:
            return self._persona
