# 12 — Sub-agent tools (`spawn` / `ask` / `dismiss`)

**Milestone:** M6 — Sub-agents
**Depends on:** 01 (tools wired), 02 (audit log shape).

## Why

Some work doesn't belong in the active persona's context: running a one-off small task, sanity-checking an idea, or iterating on a tricky bit of design without polluting the main thread. A sub-agent is a **fresh-context worker** the active persona spawns with hand-picked initial context. The master decides what the sub-agent sees; the sub-agent never sees the master's history.

Sub-agents are for *intra-session* delegation — they live in memory, die with the session (no persistence to disk).

## Three tools

```python
spawn_subagent(initial_context: str, task: str) -> { "id": str, "response": str }
ask_subagent(id: str, message: str) -> { "response": str }
dismiss_subagent(id: str) -> { "ok": bool }
```

- **`spawn_subagent`** — creates a fresh sub-agent. `initial_context` becomes its system prompt (the master's brief: role, constraints, what to focus on). `task` is the first user message. Returns the id **and** the first response in one call — common case is "fire one question, get one answer," so make it efficient.
- **`ask_subagent`** — follow-up message to an existing sub-agent. Sub-agent retains its own history across `ask` calls. Master can call this as many times as needed.
- **`dismiss_subagent`** — drops the sub-agent's state. Idempotent (dismissing an unknown id returns `{"ok": true}` without error). Sub-agents not dismissed are dropped at session end.

## Tool access

Sub-agents have access to **all tools the master has**, **except** `spawn_subagent`, `ask_subagent`, and `dismiss_subagent`. No nested sub-agents. Everything else — `read_file`, `write_file`, `edit_file`, `execute_command`, `run_in_project`, `inbox_post`/`read`/`resolve`, `search_rules`, `load_rule` — is available.

Implementation: filter the tool list when building the sub-agent's tool definitions; everything else is identical to the master's setup.

## Model and context

Same session model, same `num_ctx`. No special config. The sub-agent is just another Ollama chat with a separate message history.

## Storage

In-memory only. A simple `dict[str, SubagentState]` on the orchestrator keyed by sub-agent id. State contains: id, model, message history (list of turns), tool definitions, creation timestamp.

No JSONL on disk — sub-agents are scratch space, not session history. If the user wants to keep a sub-agent's transcript, they can copy it from the audit log (which records its tool calls — see below).

## Audit

Every sub-agent tool call goes to `tool_audit.jsonl` with an extra `subagent_id` field so the lineage is traceable:

```json
{
  "ts": "...", "persona": "developer", "subagent_id": "01HG...",
  "tool": "read_file", "args": {...}, "exit_status": 0, ...
}
```

The spawn/ask/dismiss calls themselves are also logged (without `subagent_id` on `spawn`, since the id is the result — log it in `output_preview` or a `result_id` field).

## UI

Don't add a full sub-agent panel in this task. Keep it minimal:

- When a sub-agent is spawned, status line shows: `Subagents: 1` (or however many are active).
- Each sub-agent tool call shows in the history with a `[sub:<short-id>]` prefix on the system message: `→ tool: read_file [sub:01HG]`.
- A `/subagents` user command lists active sub-agents (id, created at, message count). Useful when iterating and you've lost track.

## Token accounting

Sub-agent calls return their own `prompt_eval_count` / `eval_count` from Ollama. Track them per sub-agent (same precision rule as the main session — never estimate). Surface the sub-agent total in `/subagents` output so the user knows when one is getting expensive.

## Acceptance

- Developer persona calls `spawn_subagent(initial_context="You are a Python typing expert. Critique only what the user shows you.", task="Here is foo.py: <content>. What's wrong with the types?")`, gets back `{id, response}`.
- Master calls `ask_subagent(id, "Now what would you change about the error handling in the same file?")` and gets a coherent follow-up — the sub-agent remembers the file.
- Sub-agent's `read_file` call (e.g., to look up a related file the master mentioned) appears in `tool_audit.jsonl` with the right `subagent_id`.
- `spawn_subagent` does not appear in the sub-agent's own tool list (verify by asking the sub-agent to spawn one and seeing it report the tool is unavailable).
- `dismiss_subagent(id)` removes the state; a subsequent `ask_subagent(id, ...)` returns a structured error.
- `/subagents` lists the current set.
