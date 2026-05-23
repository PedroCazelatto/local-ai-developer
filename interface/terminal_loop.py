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
SCROLL_STEP = 3

# SGR mouse tracking: button events + SGR coordinate format.
MOUSE_ENABLE = "\x1b[?1000h\x1b[?1006h"
MOUSE_DISABLE = "\x1b[?1006l\x1b[?1000l"


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
        self._is_processing = False

        self._buffer = ""
        self._cursor = 0

        self._scroll_offset = 0

        self._input_history: list[str] = []
        self._input_history_pos = -1  # -1 = live buffer; 0+ = index from most recent
        self._saved_buffer = ""

        self._lock = threading.Lock()
        self._work_cv = threading.Condition(self._lock)
        self._work_items: list[str] = []
        self._exit_requested = False

        self._layout = Layout()
        self._layout.split_column(
            Layout(name="history", ratio=1),
            Layout(name="input", size=3),
            Layout(name="status", size=4),
        )

    # ------------------------------------------------------------------ state mutators

    def set_persona(self, persona: str) -> None:
        with self._lock:
            self._persona = persona

    def update_tokens(self, tokens_used: int) -> None:
        with self._lock:
            self._tokens_used = tokens_used

    def _insert_before_queued_locked(self, msg: ChatMessage) -> None:
        """Insert a freshly-produced message before any pending queued user messages."""
        insert_idx = len(self._messages)
        for i, m in enumerate(self._messages):
            if m.get("queued"):
                insert_idx = i
                break
        self._messages.insert(insert_idx, msg)

    def add_user_message(self, content: str) -> None:
        with self._lock:
            self._messages.append({"role": "user", "content": content})

    def add_system_message(self, content: str) -> None:
        with self._lock:
            self._insert_before_queued_locked({"role": "system", "content": content})

    def clear_messages(self) -> None:
        with self._lock:
            self._messages.clear()
            self._scroll_offset = 0

    def begin_stream(self) -> None:
        with self._lock:
            for m in self._messages:
                m.pop("queued", None)
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
                self._insert_before_queued_locked(
                    {"role": "assistant", "content": content, "persona": persona}
                )
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
            self._input_history_pos = -1
            self._saved_buffer = ""
            self._scroll_offset = 0
            if not stripped:
                return
            self._input_history.append(text)
            self._work_items.append(text)
            if not stripped.startswith("/"):
                msg: ChatMessage = {"role": "user", "content": text}
                if self._is_streaming or self._is_processing:
                    msg["queued"] = True
                self._messages.append(msg)
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
                self._is_processing = True
                return [first]
            batch = [first]
            while self._work_items:
                nxt = self._work_items[0]
                if nxt.strip().startswith("/"):
                    break
                batch.append(self._work_items.pop(0))
            self._is_processing = True
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
            scroll_offset = self._scroll_offset

        cols = self.console.size.width
        rows = self.console.size.height
        history_height = max(rows - 7, 4)  # 3 input panel rows + 4 status block rows
        avail_height = max(history_height - 1, 1)  # rule header takes 1 line
        avail_width = max(cols, 10)

        history_panel, _total, clamped = self.renderer.build_history_panel(
            persona,
            messages,
            avail_height=avail_height,
            avail_width=avail_width,
            streaming=streaming if is_streaming else None,
            thinking=thinking and is_streaming,
            scroll_offset=scroll_offset,
        )
        if clamped != scroll_offset:
            with self._lock:
                self._scroll_offset = clamped

        input_line = self.renderer.build_input_line(
            persona=persona,
            buffer=buffer,
            cursor_pos=cursor,
        )
        status_line = self.renderer.build_status_line(
            project=self._project,
            model=self._model,
            tokens_used=tokens_used,
            num_ctx=self._num_ctx,
            is_streaming=is_streaming,
            queued=queued,
        )

        self._layout["history"].update(history_panel)
        self._layout["input"].update(input_line)
        self._layout["status"].update(status_line)

    def _queued_count_locked(self) -> int:
        if not self._is_streaming:
            return 0
        return sum(1 for x in self._work_items if not x.strip().startswith("/"))

    # ------------------------------------------------------------------ scroll & history

    def _scroll_history(self, delta_lines: int) -> None:
        with self._lock:
            self._scroll_offset = max(0, self._scroll_offset + delta_lines)
            # Upper bound is enforced inside the renderer and reported back via _refresh_layout.

    def _try_unqueue_locked(self) -> bool:
        """Pop the most recent queued user message into the input buffer. Returns True if done."""
        for i in range(len(self._messages) - 1, -1, -1):
            m = self._messages[i]
            if m.get("queued") and m.get("role") == "user":
                content = m.get("content", "")
                del self._messages[i]
                # Remove the matching submission from the work queue.
                for j in range(len(self._work_items) - 1, -1, -1):
                    if self._work_items[j] == content:
                        del self._work_items[j]
                        break
                self._buffer = content
                self._cursor = len(content)
                self._input_history_pos = -1
                self._saved_buffer = ""
                return True
        return False

    def _nav_history_up(self) -> None:
        with self._work_cv:
            if not self._buffer and self._try_unqueue_locked():
                return
            if not self._input_history:
                return
            if self._input_history_pos == -1:
                self._saved_buffer = self._buffer
                self._input_history_pos = 0
            elif self._input_history_pos < len(self._input_history) - 1:
                self._input_history_pos += 1
            else:
                return
            idx = len(self._input_history) - 1 - self._input_history_pos
            self._buffer = self._input_history[idx]
            self._cursor = len(self._buffer)

    def _nav_history_down(self) -> None:
        with self._lock:
            if self._input_history_pos == -1:
                return
            self._input_history_pos -= 1
            if self._input_history_pos == -1:
                self._buffer = self._saved_buffer
                self._saved_buffer = ""
            else:
                idx = len(self._input_history) - 1 - self._input_history_pos
                self._buffer = self._input_history[idx]
            self._cursor = len(self._buffer)

    # ------------------------------------------------------------------ input handling

    def _read_key(self) -> Optional[str]:
        if msvcrt is None or not msvcrt.kbhit():
            return None
        return msvcrt.getwch()

    def _drain_pending_chars(self, max_wait: float = 0.005) -> str:
        if msvcrt is None:
            return ""
        chars = ""
        deadline = time.time() + max_wait
        while True:
            if msvcrt.kbhit():
                chars += msvcrt.getwch()
                deadline = time.time() + max_wait
            elif time.time() >= deadline:
                break
            else:
                time.sleep(0.0005)
        return chars

    def _handle_csi(self, seq: str) -> None:
        """Handle a CSI sequence body (the part after ESC [)."""
        if not seq:
            return
        # SGR mouse: '<btn;col;row[Mm]'.
        if seq.startswith("<") and seq[-1:] in ("M", "m"):
            try:
                button = int(seq[1:-1].split(";", 1)[0])
            except (ValueError, IndexError):
                return
            if button == 64:  # scroll up
                self._scroll_history(SCROLL_STEP)
            elif button == 65:  # scroll down
                self._scroll_history(-SCROLL_STEP)
            return
        final = seq[-1]
        if final == "A":  # Up
            self._nav_history_up()
            return
        if final == "B":  # Down
            self._nav_history_down()
            return
        with self._lock:
            if final == "C" and self._cursor < len(self._buffer):  # Right
                self._cursor += 1
            elif final == "D" and self._cursor > 0:  # Left
                self._cursor -= 1
            elif final == "H":  # Home
                self._cursor = 0
            elif final == "F":  # End
                self._cursor = len(self._buffer)
            elif seq == "3~" and self._cursor < len(self._buffer):  # Delete
                self._buffer = self._buffer[: self._cursor] + self._buffer[self._cursor + 1 :]

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
        if key in ("\x00", "\xe0"):  # Windows legacy extended-key prefix
            ext = msvcrt.getwch() if msvcrt and msvcrt.kbhit() else ""
            if ext == "H":  # Up
                self._nav_history_up()
                return
            if ext == "P":  # Down
                self._nav_history_down()
                return
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
        if key == "\x1b":  # ESC — VT escape sequence
            tail = self._drain_pending_chars()
            if not tail:
                return
            if tail.startswith("["):
                self._handle_csi(tail[1:])
            elif tail.startswith("O") and len(tail) >= 2:
                pass  # SS3 sequences (F1-F4) — ignored.
            return
        if key == "\x15":  # Ctrl+U
            with self._lock:
                self._buffer = ""
                self._cursor = 0
            return
        if key == "\x17":  # Ctrl+W
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
            self._input_history_pos = -1
            self._saved_buffer = ""

    # ------------------------------------------------------------------ run

    def run(self, handler: Callable[[list[str]], None]) -> None:
        worker = threading.Thread(target=self._worker, args=(handler,), daemon=True)
        worker.start()

        sys.stdout.write(MOUSE_ENABLE)
        sys.stdout.flush()
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
            sys.stdout.write(MOUSE_DISABLE)
            sys.stdout.flush()
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
            finally:
                with self._lock:
                    self._is_processing = False

    # ------------------------------------------------------------------ accessors for handler

    @property
    def persona(self) -> str:
        with self._lock:
            return self._persona
