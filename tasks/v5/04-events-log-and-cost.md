> **Status:** ⬜ Not started

# 04 — Events log, cost visibility, and error surfacing

**Version:** V5
**Depends on:** V1/06 (tool-audit log — same JSONL machinery, sibling file), V1/02 (tool registry + dispatch + structured errors), Foundation/03 (exact token counts), Foundation/06 (phase abstraction + isolated histories), V4/04 (per-phase memory persistence — the memory-load/summarization events fire here), V5/01 (sub-agent spawns + per-sub-agent token totals).
**Blocks:** V5/05 (README documents the events log + cost surfacing).

## Why

The audit log records **tool calls**, but the orchestrator also takes **structural actions** the user can't currently see or replay: switching phases, loading a phase's memory, firing the summarization failsafe, spawning a sub-agent. CLAUDE.md requires everything auditable and tokens exact; the ROADMAP "Cross-cutting backlog" bundles three loose ends — an **events log**, **cost visibility** (exact per-phase / per-sub-agent token totals), and an **error-surfacing pass** so a tool never kills the stream. This task closes all three. It is cross-cutting cleanup, not a new feature surface.

## Behavior

### 1. Orchestrator-level events log

Append one JSON line per orchestrator-level event to a **sibling** of the audit log, same JSONL style, different file:

```
projects/<active>/.orchestrator/events.jsonl
```

Event line shape (concrete, no `any`):

```ts
interface OrchestratorEvent {
  ts: string;            // ISO 8601
  type: "phase_swap" | "memory_load" | "summarization_fire" | "subagent_spawn" | "subagent_dismiss" | "model_use";
  phase: string;         // active phase at the time ("" if N/A)
  subagentId?: string;   // present for sub-agent events
  detail: Record<string, string | number | boolean>;  // type-specific, e.g. { from: "discovery", to: "design" }
  promptTokens?: number; // exact, when the event carries a token figure
  evalTokens?: number;   // exact
}
```

Events to emit (at minimum):

- **`phase_swap`** — `/swap` or Shift+Tab cycle: `{ from, to }`.
- **`memory_load`** — a phase's persisted history loaded on activation (V4/04): `{ phase, turnsLoaded }` + the **exact** restored `prompt_eval_count` if available.
- **`summarization_fire`** — the token-threshold failsafe (V4/05) compacts oldest turns: `{ before, after }` exact prompt-token counts.
- **`subagent_spawn`** / **`subagent_dismiss`** (V5/01): `{ subagentId }` (+ initial token figures on spawn).
- **`model_use`** (V5/02 `/models use`): `{ from, to }`.

This file is **append-only**, written through the same JSONL writer the audit log uses (V1/06). It is **not** loaded into any prompt — it's for the user / replay only. It lives under the **active project** (where the audit log lives), not the orchestrator repo.

### 2. Cost visibility (exact per-phase / per-sub-agent token totals)

- Maintain a running **exact** token total per phase and per sub-agent, accumulated from each turn's `prompt_eval_count` / `eval_count` (CLAUDE.md: always exact, never estimated).
- Surface these where the user already looks: the **status line** (V5/03) and the **audit log** entries already carry per-call counts; this task adds the **cumulative per-phase total** to the status line context and the **per-sub-agent total** to `/subagents` (V5/01). If a turn's count is missing, mark that total as approximate/incomplete and say so — do not paper over it with an estimate.

### 3. Error-surfacing pass

Audit every tool against the registry's structured-error contract (V1/02) and fix any that still throw:

- **Every tool returns a structured, recoverable error** — `{ error: { code, message, ... } }` the model can read and retry from — rather than throwing an exception that kills the streaming turn.
- The turn loop catches a tool failure, **feeds the structured error back** to the model as the tool result, and continues; the user sees the error in scrollback + the audit log, the stream survives.
- Errors that genuinely cannot be recovered (e.g. the Ollama daemon is down) are surfaced clearly to the user and end the turn gracefully — never a raw stack trace that drops the REPL.

## Files

- `src/core/session/events-log.ts` *(new)* — `appendEvent(event: OrchestratorEvent)`; reuses the V1/06 JSONL writer, targets `projects/<active>/.orchestrator/events.jsonl`. Typed event union (no `any`).
- `src/core/session/orchestrator.ts` — emit events at the swap / memory-load / summarization / spawn / dismiss / model-use sites; hold the per-phase exact token totals.
- `src/core/session/subagents.ts` (from V5/01) — emit spawn/dismiss events; expose per-sub-agent exact token totals to `/subagents`.
- `src/tools/*` — sweep each tool to confirm it returns the structured error shape; fix stragglers that throw.
- `src/core/session/turn-loop.ts` (or wherever the tool-dispatch round loop lives — Foundation/06's `_run_turn` port) — ensure a tool error is fed back as a tool result and the stream continues; only unrecoverable conditions end the turn, and gracefully.
- `src/core/ui/status-line.ts` — show the cumulative exact per-phase token total alongside the per-turn figures.

## Notes / pitfalls

- **Two files, one style.** `events.jsonl` is a **sibling** of `tool_audit.jsonl` under `projects/<active>/.orchestrator/` — same append-only JSONL writer, distinct concerns (orchestrator structural events vs. model tool calls). Do not merge them.
- **Tokens always exact (CLAUDE.md).** Per-phase / per-sub-agent totals and any token figure in an event line are summed exact counts. A missing count is surfaced as incomplete, never estimated.
- **Events are not prompt context.** `events.jsonl` is never injected into any phase's `messages` — it's a replay/audit artifact, same as the audit log.
- **Recoverable means recoverable.** The point of the error pass is that the model keeps working: a single tool failure must not abort the turn. Validate that traversal attempts, missing files, failing commands, unknown sub-agent ids, and a not-pulled model all come back as structured errors, not throws.
- **Phase terminology.** Event `phase` field and any detail keys use phase names — no "persona"/"role".
- **Under the active project.** Like the audit log, the events log lives with the project repo (CLAUDE.md: per-project persistence), not in the orchestrator repo.

## Acceptance

Verify by driving a live `run start` session and inspecting `projects/<active>/.orchestrator/events.jsonl`:

- `/swap design` writes a `phase_swap` line `{ from: "discovery", to: "design" }`; on a restart that reloads a phase's persisted history, a `memory_load` line appears with the exact restored token count.
- Driving a phase long enough to trip the V4/05 summarization failsafe writes a `summarization_fire` line with exact before/after prompt-token counts.
- Spawning and dismissing a sub-agent (V5/01) writes `subagent_spawn` / `subagent_dismiss` lines carrying the `subagentId`; `/models use` writes a `model_use` line.
- The status line shows a cumulative **exact** per-phase token total; `/subagents` shows an exact per-sub-agent total; both cross-check against the summed Ollama counts in the audit log.
- Forcing a tool error (path traversal in `execute_command`, a missing file in `read_file`, a failing `run_in_project` command, an unknown id in `ask_subagent`) returns a structured error fed back to the model — the turn continues, the error shows in scrollback + audit log, and the REPL never drops to a stack trace.
- Killing the Ollama daemon mid-turn surfaces a clear error and ends the turn gracefully (REPL still alive), not a raw crash.
