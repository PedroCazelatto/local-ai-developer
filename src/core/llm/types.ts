// The vocabulary this folder speaks, owned by no single function in it (constitution: a type no
// function owns lives in the folder's types.ts). Two groups: the ollama package's structural types,
// re-exported rather than redefined so the whole codebase says "message" the same way; and the closed
// union of call ROLES, which every model call names and which decides that call's num_ctx ceiling.

import type { Message } from 'ollama';

export type { Message, Tool, ToolCall } from 'ollama';

/**
 * EXACT token counts from Ollama — never estimated. `null` means Ollama did not report the
 * metric on this call; the distinction between "0 tokens" and "not reported" is preserved
 * (never coerce null → 0). The whole VRAM-safety model depends on these being exact.
 */
export interface TokenCounts {
  readonly promptTokens: number | null; // exact prompt_eval_count; null if omitted
  readonly evalTokens: number | null; // exact eval_count; null if omitted
}

export interface ChatResult {
  readonly message: Message; // final assistant message, incl. content AND tool_calls
  readonly tokens: TokenCounts;
}

// ------------------------------------------------------------------------------------- call roles
//
// The set is CLOSED, and that is the point: every model call in this repo is one of these eleven, so
// "which ceiling does this call get?" has exactly one answer per role and a mistyped role is a compile
// error rather than a silent fall-through to the base. It is the same guarantee phase-tool-names.ts
// gets from its arrays — policy as data, in one readable place — obtained here from the type system,
// since the values are resolved at every call rather than once per phase.
//
// The split into two halves is not decoration. A WINDOW holds tools and a history and streams; a
// ONE-SHOT holds neither and is discarded when it answers (docs/mental-model.md). Only a window may
// stream, and only a one-shot may be handed to `oneShot`, so the two sub-unions are what stop a
// one-shot claiming to be a Worker and quietly taking the Worker's ceiling.

/**
 * A call that owns a `messages` array and a tool surface: the interactive phases, the three spawned
 * execution windows, and a sub-agent. Every one of these sits at the BASE ceiling — see
 * resolve-window-ctx.ts for why that is structural rather than conventional.
 */
export type WindowRole = 'interactive' | 'worker' | 'reviewer' | 'retro' | 'subagent';

/**
 * A fresh, history-free, tool-free call that is never appended to any phase's memory (`oneShot`).
 * These are the roles whose ceiling may differ from the base — though today only three of the six do.
 *
 * - `context-title` — one line of ≤60 chars describing why a phase context exists.
 * - `summarize` — the summarization failsafe; its input is ~half a full window, so it stays at base.
 * - `search-rules` — matches an intent against the standards catalog.
 * - `commit-message` — writes a commit message from the real diff.
 * - `debate-turn` — one challenger or proponent turn of a deliberation loop.
 * - `debate-digest` — the third window that distils where a debate landed.
 */
export type OneShotRole =
  | 'context-title'
  | 'summarize'
  | 'search-rules'
  | 'commit-message'
  | 'debate-turn'
  | 'debate-digest';

/** Every model call this orchestrator makes, window and one-shot alike. */
export type CallRole = WindowRole | OneShotRole;
