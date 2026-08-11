# Move both logs into SQLite tables

**Category:** Memory / context

Two append-only JSONL logs sit side by side under `projects/<active>/.orchestrator/`, written through the
same `appendJsonlLine` writer with an fsync per row:

- **`tool_audit.jsonl`** (`audit.ts`) — one row per dispatched tool call: `ts`, `phase`, `tool`, `args`,
  `exit_status`, `duration_ms`, `output_truncated`, `output_preview` (capped at
  `OUTPUT_PREVIEW_LIMIT` = 1 024 bytes), `error`, plus optional `metadata` and `subagent_id`. Described in
  its own header as *"the only safety net for autonomous, no-confirmation tool calls."*
- **`events.jsonl`** (`events-log.ts`) — one row per harness-level structural action: `ts`, `type`, `phase`,
  `detail`, plus optional `subagent_id`, `prompt_tokens`, `eval_tokens`.

**Nothing reads `events.jsonl`.** `summarization_fire`, `turn_cancelled`, `debate`, `context_title` and
`eviction_fire` are all written to a file no command surfaces — `/audit` reads the *tool* log
(`read-audit-rows.ts`). So a user watching an unexplained 12–31 s pause has no in-app way to see why, which
is the same gap `/audit` was built to close for tool calls.

## The decision

**Both logs become tables in the project's existing `memory.db`.** The store is already there, already
SQLite (`node:sqlite`, unflagged on Node 24), already per-project, and already the place the session's
durable state lives. That buys what a flat file cannot: filter by phase, order by time across *both* kinds
of row, join an event against the tool calls around it, and read the tail without parsing the whole file.

This is a deliberate trade against the reason the logs are flat today. `audit.ts`'s header makes the
durability argument explicitly — append-only plus fsync-per-row means *"a kill mid-tool leaves a partial
LAST line at worst, never a torn earlier row"* — and `read-audit-rows.ts` implements the other half by
replaying a torn final line and **reporting** how many rows it skipped. A table gets that property from
transactions instead, which is stronger, but only if the writes are actually committed per row rather than
batched.

`events-log.ts`'s header currently states the separation as an invariant — *"Distinct concerns, never
merged: audit = the model's tool calls, events = the harness's own actions"* — and that sentence is what
this task overturns. **Two tables, not one**: the concerns stay distinct in the schema, and what unifies is
the store and the reader, not the row.

## What it touches

`audit.ts`, `events-log.ts`, `read-audit-rows.ts` and `/audit`, `memory-db.ts` and `memory-db.schema.ts`,
and every emit site — which after `6c0af21` is a single choke point for tool calls (`record-tool-call.ts`)
and a handful of `appendEvent` callers. `append-jsonl-line.ts` survives only if something else still needs
it.

## Open decisions

- **What happens to existing `.jsonl` files.** Import them into the tables on first open, leave them where
  they are and start the tables empty, or read both and merge at query time. Every project on disk has
  them.
- **Whether the audit table keeps the 1 KB `output_preview` cap.** It exists because a full build log has
  no business in a log file; a table makes storing the whole output cheap, which reopens the deferred
  full-output question the header already flags.
- **Whether `/audit` gains the events or `/events` is a second command.** The events rows have a different
  shape and a different audience; one command with a mode may read better than two.
- **Retention.** A JSONL file grows until someone deletes it, which is at least obvious. A table invites a
  retention policy, and a silent one would delete the safety net.
- **Whether a write failure is fatal.** Today a failed append throws where it happens. A tool call that
  succeeded but whose audit row failed to commit is a case the flat file never had to answer.
