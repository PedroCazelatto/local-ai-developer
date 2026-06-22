> **Status:** ⬜ Not started

# 02 — Tool registry and dispatch

**Version:** V1
**Depends on:** Foundation/06 (the tool-dispatch turn loop), Foundation/03 (Ollama tool-calling).
**Blocks:** V1/03 (file tools), V1/04 (execute_command), V1/05 (run_in_project), V1/06 (audit log hooks the dispatch choke point).

## Why

Foundation gave the model a turn loop but no actions. This task is the wiring spine: a **registry** of tool modules, a **definitions array** sent to Ollama, and a **dispatcher** that runs the right tool when the model calls it and feeds the result back. Every later tool just drops a module into `src/tools/` and is picked up automatically.

Port the principle from old `tasks/01-wire-tools-to-agents.md`: **every phase gets every tool.** No per-phase whitelist. The phase markdown (V1/01) is where the model is told *which* tools to use; the orchestrator does not gate access. If a phase misuses a tool, the fix is in its markdown, not in code.

## Behavior

### Tool module shape

Each tool is one module in `src/tools/` exporting a `ToolModule`:

```ts
interface ToolModule {
  name: string;                 // unique, snake_case, e.g. "read_file"
  description: string;          // sent to the model
  parameters: JSONSchema;       // JSON-schema object: { type:"object", properties:{...}, required:[...] }
  execute(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>;
}

type ToolResult = string | StructuredToolResult;   // a plain string is the simple success path
```

`ToolContext` (defined here, used by all tools) carries the active-project binding and the sandbox handle:

```ts
interface ToolContext {
  projectName: string;          // e.g. "hello-world"
  projectPath: string;          // host path: projects/<active> (orchestrator-side)
  workspacePath: string;        // "/workspace" — the mount point inside the sandbox
  sandbox: SandboxClient;       // Foundation/04 dockerode handle (root sandbox + project runner)
  phase: string;                // active phase name, for the audit row
  resolve(relative: string): string;   // path-scoping; see V1/03
}
```

### Registry

- `src/tools/registry.ts` discovers every `ToolModule` in `src/tools/` (explicit imports into an array is fine — no dynamic `fs` scan needed; keep it a static list the build can check). Reject duplicate `name`s at load with a loud error.
- `toolDefinitions()` builds the Ollama `tools` array from the registry: `[{ type: "function", function: { name, description, parameters } }]`. This array is sent on **every** chat/stream call for **every** phase.

### Dispatch

The dispatcher is the single choke point (V1/06 audit log hooks here):

1. The model returns one or more `tool_calls`, each `{ function: { name, arguments } }` where `arguments` is a JSON string (Ollama) or object — normalize to an object.
2. Look the tool up by `name`. If unknown → return a **structured recoverable error** (do not throw): a `tool` message whose content is `{"error": "unknown tool 'foo'", "available": ["list_files", ...]}` so the model can self-correct.
3. If `arguments` fails JSON parse, or a required parameter is missing/wrong-typed, return a structured recoverable error naming the offending field — again as a `tool` message, never an exception that kills the turn.
4. Otherwise `await tool.execute(ctx, args)`. Wrap in try/catch: an unexpected throw becomes a structured error result (`{"error": "<message>"}`), still recoverable.
5. Append the result to the phase's history as a `tool` role message tied to the call (`{ role: "tool", name, content }`). For a string result, `content` is the string; for a structured result, `content` is its JSON string.
6. Re-invoke the model so it sees the tool output. Honor Foundation/06's bounded round cap so a tool-call loop can't run forever.

### Structured recoverable error shape

All tools and the dispatcher use one shape the model can read and retry from:

```json
{ "error": "human-readable reason", "hint": "optional: what to do instead" }
```

The turn never dies on a bad/unknown call — the model gets the error as tool output and tries again.

## Files

- `src/tools/types.ts` — `ToolModule`, `ToolContext`, `ToolResult`, `StructuredToolResult`, `JSONSchema`.
- `src/tools/registry.ts` — static list of modules, dedupe check, `toolDefinitions()`.
- `src/core/session/dispatch.ts` (or fold into the Foundation/06 turn loop) — name lookup, arg validation, execute, structured-error fallback, `tool` message append, audit hook (V1/06).
- `src/core/session/orchestrator.ts` — builds `ToolContext` per turn from the active project + phase + sandbox handle and passes `toolDefinitions()` on every Ollama call.

## Notes / pitfalls

- **No per-phase tool gating.** Sending the full set to every phase is deliberate (old task 01). Resist adding a whitelist.
- **Errors are recoverable, never thrown past the dispatcher.** A thrown tool must still produce a `tool` message and an audit row (V1/06, `exit_status: -1`). This is the difference between "the model retries" and "the session dies."
- **Tokens stay exact.** The extra `tool` messages count toward the window; the Ollama response's `prompt_eval_count`/`eval_count` remain the source of truth (CLAUDE.md). Do not estimate.
- **Ollama arg quirk:** `tool_calls[].function.arguments` may arrive as a JSON string *or* an object depending on the model/client version — normalize before validating.
- The registry feeds the model the same definitions regardless of phase; the *steering* is entirely in the phase markdown.

## Acceptance

- `run start hello-world`, `/swap worker`, ask it to read `README.md` → a real `read_file` call executes and its output comes back into the window (visible as a tool line in the UI).
- `/swap discovery`, ask the same → also works; no phase is blocked from any tool.
- Force a bad call in a scripted check (model emits `read_file` with no `path`, or calls `does_not_exist`) → the window receives a structured `{"error": ...}` tool message and the turn continues instead of crashing.
- Every successful and failed call produces exactly one audit row (V1/06).
