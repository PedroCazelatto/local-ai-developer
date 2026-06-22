> **Status:** ⬜ Not started

# 06 — Tool-call audit log

**Version:** V1
**Depends on:** V1/02 (the dispatch layer is the choke point this hooks).
**Blocks:** trustworthy review of a session after the fact (CLAUDE.md: *"Every tool call must be logged for later audit."*).

## Why

Tool calls run **autonomously, no confirmation prompts** (CLAUDE.md, "Sandboxing & tools"). The only safety net is the audit log. Without it, reviewing what the model did is impossible. Port old `tasks/02-tool-call-audit-log.md` (persona → phase): append one JSON line per tool call to disk, at the single dispatch choke point.

## Behavior

- Append **one JSON object per line** (JSONL) to `projects/<active>/.orchestrator/tool_audit.jsonl`.
- Written from the **dispatch layer** (V1/02) — the one place every tool call passes through. Tools don't write their own rows; the dispatcher wraps `execute()` and records.
- **Append-only**, flushed after each row (so a kill mid-tool doesn't corrupt the file — partial last line at worst, never a torn earlier row).
- The directory and file are **created on first write** — no startup dance.

### Row schema

```json
{
  "ts": "2026-06-21T19:30:00.123Z",
  "phase": "worker",
  "tool": "run_in_project",
  "args": { "command": "npm test", "timeout_s": 120 },
  "exit_status": 0,
  "duration_ms": 412,
  "output_truncated": false,
  "output_preview": "...first ~1KB of the result...",
  "error": null
}
```

Field rules:
- `ts` — **UTC ISO-8601 with millisecond precision** (`new Date().toISOString()`).
- `phase` — the active phase name (`discovery`/`design`/`breakdown`/`worker`/...). **`phase`, not `persona`** — the old Python used `persona`; do not carry that name over.
- `tool` — the tool name as dispatched.
- `args` — the (normalized, parsed) arguments object the tool received.
- `exit_status` — `0` for success; the real exit code for `execute_command`/`run_in_project`; **`-1` for any failure** (tool threw, bad/unknown call, escape rejection, Docker unreachable, timeout). File tools that return a result string use `0`.
- `duration_ms` — wall-clock around `execute()`.
- `output_truncated` — `true` if `output_preview` is a truncation of a larger result.
- `output_preview` — first ~1 KB of the tool's result (string result, or the JSON of a structured result). **Never dump full output** — large stdout/build logs stay out of the log; only a preview is kept (full output persistence is deferred).
- `error` — `null` on success; the structured error's message (or the thrown message) on failure. Failure rows still record `phase`/`tool`/`args`/`ts`/`duration_ms`.

### Hooking the choke point

In the V1/02 dispatcher, wrap each call:
1. capture `start = now()`
2. run the tool (or hit the bad/unknown/escape path)
3. compute `duration_ms`, derive `exit_status`/`error`/`output_*`
4. append the row, then continue feeding the result back to the model

A failed/unknown/rejected call **still gets a row** with `exit_status: -1` and `error` set — the model also still gets its recoverable error message (V1/02).

## Files

- `src/core/session/audit.ts` — `appendAuditRow(projectPath, row)`: ensures `<projectPath>/.orchestrator/` exists, appends one line + newline, flushes.
- `src/core/session/dispatch.ts` (V1/02) — calls `appendAuditRow` for every dispatched call (success and failure).

### `.orchestrator/` layout (convention used by later tasks)

```
projects/<name>/.orchestrator/
  tool_audit.jsonl     # this task
  backlog.json         # V1/09
  memory/              # V4 (per-phase history)
  inbox/               # V3 (cross-phase inbox)
  events.jsonl         # V5 (orchestrator events)
```

## Notes / pitfalls

- **One choke point only.** If audit writes live inside individual tools, some path (a thrown tool, an unknown-tool error) will skip the log. Write from the dispatcher so *every* outcome is recorded.
- **`-1` for all failures**, including timeouts and escape rejections — matches the old task and lets a reviewer grep failures with one predicate.
- **Truncate the preview, not the model's result.** The tool still returns full (or its own-truncated) output to the window; the audit only keeps ~1 KB.
- **Append-only + flush-per-row** — never rewrite the file. Killing the process mid-write must leave all prior rows intact.
- **`phase` not `persona`** — and don't leak the legacy term into the schema or code.
- **Tokens:** the audit doesn't touch token accounting, but if a row ever needs a token figure, it must be the exact `prompt_eval_count`/`eval_count` from Ollama, never an estimate (CLAUDE.md). V1 rows carry no token field.

## Acceptance

- A Worker session that calls 3 tools → `projects/<active>/.orchestrator/tool_audit.jsonl` has exactly 3 lines, each parseable as JSON, each with `phase: "worker"` and a UTC-ms `ts`.
- Force a tool error (unknown tool, or `read_file` on a missing path) → a row with `exit_status: -1` and a non-null `error`.
- `run_in_project("npm i")` first time → a build row **and** a run row (V1/05), both present.
- Kill the process mid-`run_in_project` → reopening the file, every line before the kill still parses (no torn row).
