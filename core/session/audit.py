import json
import os
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_PREVIEW_LIMIT = 1024


class ToolAuditLogger:
    """Append-only JSONL audit log of every tool call."""

    def __init__(self, project_path: str) -> None:
        self._path = Path(project_path) / ".orchestrator" / "tool_audit.jsonl"

    @property
    def path(self) -> Path:
        return self._path

    def record(
        self,
        *,
        persona: str,
        tool: str,
        args: Mapping[str, object],
        output: str,
        duration_ms: int,
        exit_status: int = 0,
        error: str | None = None,
    ) -> None:
        preview = output[:OUTPUT_PREVIEW_LIMIT]
        row: dict[str, object] = {
            "ts": _utc_iso_now(),
            "persona": persona,
            "tool": tool,
            "args": dict(args),
            "exit_status": exit_status,
            "duration_ms": duration_ms,
            "output_truncated": len(output) > OUTPUT_PREVIEW_LIMIT,
            "output_preview": preview,
        }
        if error is not None:
            row["error"] = error

        self._path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(row, ensure_ascii=False, default=str) + "\n"
        with open(self._path, "a", encoding="utf-8") as fp:
            fp.write(line)
            fp.flush()
            os.fsync(fp.fileno())


def _utc_iso_now() -> str:
    """UTC ISO-8601 timestamp with millisecond precision, e.g. 2026-05-22T19:30:00.123Z."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S") + f".{now.microsecond // 1000:03d}Z"
