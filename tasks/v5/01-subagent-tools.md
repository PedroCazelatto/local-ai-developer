> **Status:** ⬜ Not started

# 01 — Sub-agent tools (`spawn` / `ask` / `dismiss`)

**Version:** V5
**Depends on:** V1/02 (tool registry + dispatch), V1/06 (tool-audit log), Foundation/03 (Ollama client `chat`/`stream` + exact token counts), Foundation/06 (phase abstraction + isolated histories).
**Blocks:** V5/03 (status line surfaces the sub-agent count), V5/04 (per-sub-agent exact token totals in the events log + audit).

## Why

Some work doesn't belong in the active **phase**'s context: a one-off side-task, sanity-checking an idea, or iterating on a tricky bit of design without polluting the main thread. A **sub-agent** is a fresh-context worker the active phase spawns with hand-picked initial context — the same mental model as a spawned execution window (CLAUDE.md "Core mental model"), but spawned by the *model* mid-turn rather than by the orchestrator. The master phase decides exactly what the sub-agent sees; the sub-agent never sees the master's history. Sub-agents are for *intra-session* delegation only — they live in memory and die with the session (no JSONL on disk).

## Behavior

Three tools, available to every phase. Concrete TS signatures (no `any`):

```ts
spawn_subagent(initial_context: string, task: string): { id: string; response: string }
ask_subagent(id: string, message: string): { response: string }
dismiss_subagent(id: string): { ok: boolean }
```

- **`spawn_subagent`** — creates a fresh sub-agent: a new empty `messages` array seeded with `initial_context` as the **system** message (the master's brief: role, constraints, what to focus on) and `task` as the **first user** message. Runs one turn against the same local Ollama, returns the generated `id` **and** the first `response` in a single call (the common case is "fire one question, get one answer" — make it one round-trip). The `id` is a short, stable, collision-free token (e.g. a ULID/nanoid); the *short* form (first ~4 chars) is what the UI prefixes show.
- **`ask_subagent`** — sends a follow-up user message to an existing sub-agent. The sub-agent retains its own message history across `ask` calls, so it remembers the file/context it was given. The master may call this any number of times.
- **`dismiss_subagent`** — drops the sub-agent's in-memory state. **Idempotent:** dismissing an unknown or already-dismissed id returns `{ ok: true }` with no error. Any sub-agent not explicitly dismissed is dropped at session end.

**Error shape (recoverable, never throws):** `ask_subagent` against an unknown/dismissed id returns the standard structured tool error the registry uses (e.g. `{ error: { code: "unknown_subagent", message: "No active sub-agent with id <id>. It may have been dismissed or never existed." } }`) so the model can read it and recover, rather than killing the turn.

### Tool access (no nesting)

A sub-agent gets **every tool the master phase has, except the three sub-agent tools** (`spawn_subagent`, `ask_subagent`, `dismiss_subagent`). No nested sub-agents. Everything else the master can call — `read_file`, `write_file`, `edit_file`, `list_files`, `search_in_files`, `execute_command`, `run_in_project`, and (once they exist) `inbox_*`, `search_rules`, `load_rule` — is available to the sub-agent unchanged. Implementation: when building the sub-agent's tool definitions, take the master's set and **filter out the three sub-agent tools**; everything else is identical wiring (same dispatch path, same sandbox scoping, same audit).

### Model and context

Same session model, same `num_ctx`. No special config — a sub-agent is just another Ollama chat with a separate message history. When the active model changes (V5/02 `/models use`), already-spawned sub-agents keep the model they were created with for the rest of their life (do not retroactively swap a live sub-agent's model mid-conversation).

## Files

- `src/core/session/subagents.ts` *(new)* — a `SubagentManager` holding `Map<string, SubagentState>` on the orchestrator. `SubagentState` = `{ id, model, numCtx, messages: ChatMessage[], toolDefs, createdAt, promptTokens, evalTokens }` (exact token fields, see below). Methods: `spawn(initialContext, task)`, `ask(id, message)`, `dismiss(id)`, `list()`.
- `src/tools/spawn-subagent.ts`, `src/tools/ask-subagent.ts`, `src/tools/dismiss-subagent.ts` *(new)* — the three model-callable tools, each delegating to `SubagentManager`. Registered in the tool registry like every other tool; autonomous + audit-logged.
- `src/core/session/orchestrator.ts` — owns the `SubagentManager` instance, passes the master phase's filtered tool set into spawns, and exposes `list()` to the `/subagents` command and the status line (V5/03).
- `src/commands/subagents.ts` *(new)* — the `/subagents` user command (see UI).
- `src/core/llm/provider.ts` — reused as-is; sub-agent turns go through the same `chat`/`stream` path so token counts come back exact.

## Notes / pitfalls

- **Isolation is the whole point.** The sub-agent's `messages` array is **never** seeded with the master phase's history — only `initial_context` + `task`. And the master phase's history is never polluted by the sub-agent's internal turns; the master only ever sees the `{ id, response }` tool result.
- **No nesting — verify by construction.** The filter must remove the three tools from the *sub-agent's* definitions, not merely refuse them at dispatch. If a sub-agent never sees the tools, it can't call them.
- **Tokens are exact.** Each sub-agent turn returns its own `prompt_eval_count` / `eval_count` from Ollama — accumulate the exact values per sub-agent in `SubagentState`. Never estimate from string length. If a count is missing on a call, surface that explicitly (don't substitute a guess).
- **Audit every sub-agent action with `subagent_id`.** Every tool call a sub-agent makes (e.g. its own `read_file`) is logged to `.orchestrator/tool_audit.jsonl` with an extra `subagent_id` field so lineage is traceable. The `spawn`/`ask`/`dismiss` calls themselves are also logged as ordinary master-phase tool calls; `spawn` records the new id in the result (e.g. `result_id` / `output_preview`) since the id is its output, not its input. Audit lines carry `phase` (not "persona"/"role").
- **Sandbox boundary unchanged.** A sub-agent's file/command tools run inside Docker against `/workspace` (root sandbox) and the project container (`run_in_project`) — never the host. Same scoping as the master.
- **In-memory only.** No JSONL persistence for sub-agents. If the user wants a transcript, the audit log already records the sub-agent's tool calls.

## UI

Keep it minimal — no full sub-agent panel in this task:

- **Status line** shows `Subagents: N` when `N > 0`, omitted when zero (full wiring is V5/03; this task just exposes the count).
- **History prefix:** a sub-agent's tool call renders in the scrollback with a `[sub:<short-id>]` marker, e.g. `→ run_in_project [sub:01HG]`, so it's distinguishable from master-phase calls.
- **`/subagents` command** lists active sub-agents: `id`, age (since `createdAt`), message count, and the **exact** cumulative token total (prompt + eval) so the user can see when one is getting expensive.

## Acceptance

Verify by driving a live `run start` session:

- From an active phase, the model calls `spawn_subagent(initial_context="You are a TS typing reviewer; critique only what you're shown.", task="Here is src/foo.ts: <content>. What's wrong with the types?")` and gets back `{ id, response }` in one round-trip.
- A follow-up `ask_subagent(id, "Now critique the error handling in the same file.")` returns a coherent answer that references the earlier file — proving the sub-agent kept its own history.
- A sub-agent's own `read_file` (e.g. to open a related file) appears in `tool_audit.jsonl` with the correct `subagent_id`; the master phase's own calls have no `subagent_id`.
- The sub-agent **cannot** spawn its own sub-agent: asking it to do so, it reports the tool is unavailable (and `spawn_subagent` is absent from its tool definitions).
- `dismiss_subagent(id)` returns `{ ok: true }`; a second `dismiss_subagent(id)` on the same id also returns `{ ok: true }` (idempotent); a subsequent `ask_subagent(id, ...)` returns the structured `unknown_subagent` error without killing the turn.
- `/subagents` lists the current active set with id, age, message count, and exact token total; the status line shows `Subagents: N` while any are active and drops the field once all are dismissed.
- The token totals shown for each sub-agent equal the summed exact `prompt_eval_count`/`eval_count` from its Ollama turns (cross-check against the audit / events log).
