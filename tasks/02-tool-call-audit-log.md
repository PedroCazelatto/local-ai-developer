# 02 — Tool-call audit log

**Milestone:** M1 — Tools online
**Depends on:** 01 (need real tool calls to log).

## Why

CLAUDE.md states: *"Every tool call must be logged for later audit."* Today, tool invocations only show in the UI (`ui.add_system_message(f"→ tool: {name}")` in `main.py:35`) and the tool output goes into the in-memory `Memory`. Nothing reaches disk, so reviewing a session after the fact is impossible.

## Files

- `core/session/orchestrator.py` — `call_tool` is the natural choke point.
- `main.py:31-37` — currently the call site that emits the UI line; can stay, but the audit write should not depend on the UI.

## Behavior

Append one JSON object per line to `projects/<active-project>/.orchestrator/tool_audit.jsonl`. Suggested schema:

```json
{
  "ts": "2026-05-22T19:30:00.123Z",
  "persona": "developer",
  "tool": "execute_command",
  "args": { "command": "pytest -q" },
  "exit_status": 0,
  "duration_ms": 412,
  "output_truncated": false,
  "output_preview": "...first 1KB..."
}
```

Notes:

- Don't dump full output into the log if it's huge — store a preview and the full output elsewhere if you ever need it (proposal: leave that to later, just truncate for now).
- Failures (tool raised, model passed malformed args) should still produce a row, with `exit_status: -1` and an `error` field.
- Use UTC ISO-8601 timestamps with millisecond precision.

## Folder layout

This task introduces the convention used by later tasks (04, 08):

```
projects/<name>/.orchestrator/
  tool_audit.jsonl
  inbox/              # task 04
  memory/             # task 08
  events.jsonl        # cross-cutting backlog, later
```

Make sure the directory is created on first write (no startup dance required).

## Acceptance

- After a Developer session that calls 3 tools, `tool_audit.jsonl` has 3 rows, each parseable as JSON.
- Killing the process mid-tool does not corrupt the file (append-only writes flush after each row).
- Tool errors appear in the log with `error` and `exit_status: -1`.
