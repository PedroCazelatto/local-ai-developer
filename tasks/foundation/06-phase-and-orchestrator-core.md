> **Status:** ⬜ Not started

# 06 — Phase abstraction + orchestrator core

**Version:** Foundation
**Depends on:** 02 (config), 03 (Ollama client: stream + exact tokens + structured tool_calls), 04 (sandbox exec for tool dispatch), 05 (REPL UI to drive)
**Blocks:** all of V1 (the tool registry, planning phases, and Worker all run inside this turn loop)

## Why

This is where Foundation's pieces become a working session. It introduces the **Phase** abstraction (the TS replacement for the Python `Agent`/`persona` — name + loaded instruction markdown + tool set, **no "persona"/"role" identifiers**), per-phase **isolated** message history with leak-free switching, and the **tool-dispatch turn loop** ported from `main.py`'s `_run_turn` / `_process_message` (bounded by `MAX_TOOL_ROUNDS = 8`). Exit criterion for the whole Foundation version: `run start` streams a turn with a real token count and a model tool call executes inside the sandbox (ROADMAP "Foundation done means…").

## Behavior

### Phase abstraction (replaces Agent/persona)

```ts
export interface Phase {
  name: string;          // e.g. "discovery" — was Agent.role; NO "persona"/"role" naming
  instructions: string;  // the loaded rules/phases/<name>.md markdown — was Agent.persona
  tools: string[];       // tool names available to this phase (empty for Foundation)
}
```

- `name` is the lowercased phase id (ports `Agent.role`).
- `instructions` is the full markdown of `rules/phases/<name>.md` (ports `Agent.persona`, which held the file text).
- `tools`: for Foundation, leave empty / not gated — the actual tool **definitions** are wired in V1. Here we only define the **dispatch seam** (see turn loop). The orchestrator does not whitelist tools per phase (CLAUDE.md: which tools a phase uses is told in its markdown, not gated in code).

### PhaseFactory

A `PhaseFactory` in `src/phases/` that discovers `rules/phases/*.md` (ports `AgentFactory`):

```ts
export class PhaseFactory {
  static availablePhases(): string[];          // sorted basenames of rules/phases/*.md
  static get(name: string): Phase;             // throws a clear error if missing, listing available
}
```

- `availablePhases()` → sorted `*.md` stems under `rules/phases/`.
- `get(name)` → normalize to lowercase, read `rules/phases/<name>.md`; if absent, throw a clear `Unknown phase: '<name>'. Available: …` error (the REPL turns this into a recoverable line — see 05's `/swap`).
- Note: the markdown phase files live under `rules/phases/`. (The CLAUDE.md "personas dir / rename pending" caveat is a Python-era artifact; in the TS tree always use `rules/phases/` and never the word persona/role.)

### Per-phase isolated memory

A `SessionMemory` in `src/core/session/` (ports `core/session/memory.py`):

- One message array **per phase name**; an `active` pointer.
- `setActivePhase(name)` creates the array if missing and points at it.
- `add(role, content, opts?)` appends `{ role, content, name?, tool_calls? }` to the **active** phase's array (a `tool` message carries `name`; an assistant tool-call turn carries `tool_calls`).
- `history` returns the active phase's array.
- `clear()` empties the active phase's array (used by V4's `/clear`; harmless to include the method now).
- **Switching phases saves the active history and loads the target's — no cross-phase leakage.** Because each phase owns its own array and the active pointer just moves, there is no copying and no bleed; assert this in the acceptance check.

### SessionOrchestrator

A `SessionOrchestrator` in `src/core/session/` (ports `core/session/orchestrator.py`), constructed from `SessionConfig` + the `OllamaClient` (03) + `SandboxClient` (04):

- Holds: the active `Phase`, `SessionMemory`, `OllamaClient`, `SandboxClient`, and `lastTurnTokens` (exact, from 03).
- `switchPhase(name)`: `phase = PhaseFactory.get(name)`; `memory.setActivePhase(name)`. (Ports `switch_agent`.)
- `buildMessages()`: prepend a system message built from the active phase's `instructions` + a one-line project-state string, then the active phase's `history`. (Ports `_build_messages` / `ContextBuilder.build_system_prompt`. A minimal builder in `src/context/` is fine for Foundation.)
- `streamAsk(userInput)`: `memory.add('user', userInput)`, then stream via the client (`buildMessages()` + tool defs).
- `streamContinue()`: stream the next assistant turn from current memory **without** injecting a user message (used after a tool result so the model continues). Ports `stream_continue`.
- `callTool(name, args)`: the **dispatch seam**. For Foundation, route to a tiny built-in dispatch table that can execute at least one tool through the sandbox (see "minimum tool" below); return a string result. Catch errors and return a structured, recoverable error string (never throw out of the turn). (Ports `call_tool`'s try/finally; the audit-log call is V1 — leave a clearly marked seam/TODO, do not build the audit logger here.)
- Token tracking: after each turn, read the client's exact `promptTokens`/`evalTokens` and expose the combined `lastTurnTokens` for the UI status line. If a count is `null`, propagate `null` (UI shows `?`) — never coerce to 0 or estimate.

### Turn loop (port of `_run_turn` / `_process_message`)

One **turn** = stream one assistant message, then dispatch any tool calls. Driven by the REPL (05):

```
processMessage(userInput):
  if !runTurn(() => streamAsk(userInput)): return          // no tool calls → done
  for round in 1..MAX_TOOL_ROUNDS:
    if !runTurn(() => streamContinue()): return             // model finished
  ui.systemMessage("⚠ Reached tool-call limit (8). Stopping.")
```

`runTurn(stream)` returns `true` if tool calls were dispatched (caller loops again), `false` otherwise:

1. UI: begin stream / start spinner (05). Pull filtered visible deltas from the client (03) and write them incrementally.
2. After the stream ends, read the **final structured message** from the client: `{ content, tool_calls }`, and the **exact** token counts → push to UI status line.
3. If `content` is non-empty, finalize it as an assistant block in the UI; else cancel the stream block.
4. **If there are NO `tool_calls`:** `memory.add('assistant', content)`; return `false`.
5. **If there ARE `tool_calls`:** store the assistant turn as `memory.add('assistant', '', { tool_calls })` — **empty content on purpose.** qwen2.5-coder's chat template renders assistant `content` **OR** `tool_calls` (an if/else), so keeping the prose would make the tool-call rendering vanish on replay. Then for each call: print `→ tool: <name>` (05), `callTool(name, args)`, and `memory.add('tool', result, { name })`. Return `true`.
6. `MAX_TOOL_ROUNDS = 8` caps the implement/continue rounds; on exhaustion, print the limit warning and stop. (Exact value ported from `main.py`.)

### Minimum tool for the Foundation exit criterion

The Foundation "done" bar requires a **model-issued tool call executing inside the sandbox**. Wire **one** read-only tool through the dispatch seam so this is demonstrable end-to-end — e.g. `read_file(path)` that runs `cat /workspace/<path>` via `SandboxClient.exec` (04) and returns the content, or `list_files` running `ls`. Send its definition to the model in `buildMessages` tool list. The full tool **registry** (discovery, many tools, audit log) is V1 — here it's a single hardcoded tool proving the loop closes.

## Files

- `src/phases/phase.ts` — the `Phase` interface.
- `src/phases/factory.ts` — `PhaseFactory` (discover/get `rules/phases/*.md`).
- `src/core/session/memory.ts` — `SessionMemory` (per-phase isolated histories).
- `src/core/session/orchestrator.ts` — `SessionOrchestrator` (state, `switchPhase`, `buildMessages`, `streamAsk`, `streamContinue`, `callTool` seam, exact token tracking).
- `src/core/session/turn-loop.ts` — `runTurn` / `processMessage` with `MAX_TOOL_ROUNDS = 8`. (May live in the orchestrator; keep it cohesive.)
- `src/context/system-prompt.ts` — minimal system-prompt builder (phase instructions + project state).
- `src/tools/read-file.ts` (or `list-files.ts`) — the single Foundation tool proving sandbox dispatch; full registry is V1.
- `src/index.ts` — wire orchestrator + UI together (the boot started in 02/05 now has a real loop).

## Notes / pitfalls

- **No "persona"/"role" anywhere in the new TS code.** The unit is a `Phase` with `name` + `instructions`. This is a hard terminology rule (CLAUDE.md / ROADMAP); do not reintroduce the Python naming even internally.
- **Store the assistant tool-call turn with empty `content`.** This is non-obvious and was a real bug class in the Python port: qwen2.5-coder's template is `content` XOR `tool_calls`. Replaying a stored turn that has both can drop the tool call. Empty the content when `tool_calls` are present (step 5).
- **Collect `tool_calls` from across the stream**, not just the last chunk — task 03 already does this; the orchestrator just consumes the assembled message. Don't re-derive tool calls here.
- **Phase histories must not leak.** Switching phases only moves the active pointer; never copy one phase's messages into another. The system prompt is rebuilt per turn from the *active* phase's instructions.
- **Tokens exact, propagate `null`.** The orchestrator must not turn a missing count into 0. (CLAUDE.md.)
- **Tool errors are recoverable.** `callTool` returns a structured error string the model can read; it never throws up into `runTurn` and kills the session. (Ports the Python try/finally that returned `"Error: …"`.)
- **Bound the loop.** Without the `MAX_TOOL_ROUNDS` cap a confused model can spin forever; keep the cap at 8 and the warning message.
- Audit logging is V1 — leave a clearly-commented seam in `callTool`, don't build it.

## Acceptance

Driven live via `.\run.ps1 start hello-world` (and/or a scripted check per the user's "verify via scripted live checks" memory):

- Sending a plain question streams one assistant turn with visible prose and a status line showing the **exact** combined token count for that turn (matching Ollama's `prompt_eval_count + eval_count`).
- `/swap design` then `/swap discovery` preserves each phase's own history independently: a message sent under `discovery` is **not** visible to `design` and vice-versa (verifiable by asking each phase "what did I just say?" — only the phase that received the message recalls it).
- Asking the active phase to read a known file in the project triggers a real tool call: a `→ tool: read_file` line prints, the command runs **inside the sandbox** at `/workspace` (task 04), the result is fed back as a `tool` message, and the model produces a final answer using the file content — closing the implement→continue loop.
- The stored assistant turn for a tool call has empty `content` + the `tool_calls` array (inspectable in memory), and replaying the history on the next round does not lose the tool call.
- A turn that issues tool calls in a runaway fashion stops after 8 rounds with the `⚠ Reached tool-call limit (8)` message rather than looping forever.
- A tool call that fails (e.g. reading a nonexistent path) returns a structured error string to the model and the session continues — no crash.
