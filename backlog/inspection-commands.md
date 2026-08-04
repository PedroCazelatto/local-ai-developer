# Add the inspection commands that close the walk-away loop

**Category:** In-app commands

The product's core loop is "start a batch, walk away, come back to a report." The come-back half is
missing. There are eleven commands and not one of them shows the state the session has been
accumulating — you have to leave the app and read files.

Everything needed is already on disk under `projects/<name>/.orchestrator/`, so these are pure reads
over existing formats. No new persistence, no model call:

- **`/tasks`** — the backlog tree with each task's status, order and unmet dependencies, and which one
  `/run next` would pick. Reads `readBacklog` (already synchronous). The single most-missed view: the
  backlog is the thing the whole session is organized around and it is invisible from inside the app.
- **`/blockers`** — open blockers with their task id and question, so `/answer` has something to read
  from instead of scrolling back. Reads `blockers.jsonl`.
- **`/inbox`** — the active phase's open items, and optionally every phase's. Reads the inbox store.
  Right now the inbox is a channel only the model can see, which makes it hard to tell whether the
  protocol is being followed at all.
- **`/batch [n]`** — re-print a persisted batch summary (default: the most recent). Reads
  `.orchestrator/batches/`. The summary is already written as pretty JSON precisely so it survives the
  REPL; nothing reads it back.
- **`/audit [n]`** — the last N tool-call rows, one line each (phase · tool · exit · duration). Reads
  `tool_audit.jsonl`. The audit log is described as "the only safety net for autonomous,
  no-confirmation tool calls" and there is currently no way to look at it in the app.

Design notes:

- These are **user** commands. Nothing here goes to the model: a phase that wants its own inbox has
  `inbox_read`, and a phase does not get to read the audit log at all.
- Output is append-only scrollback like every other command — a static, copyable block, no widget.
- Each must degrade to a recoverable line when the file or the backlog is missing, the way `/run`
  already does with `BacklogError`.

## Open decision

Whether `/tasks` also gets a compact epic/story tree rendering, or stays a flat ordered list. A flat
list matches how `/run` actually selects; a tree matches how Breakdown writes it.
