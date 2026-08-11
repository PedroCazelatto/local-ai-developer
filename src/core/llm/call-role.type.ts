// What ROLE a single model call plays. Kept in a sibling `.type.ts` per the constitution, beside the
// resolver that reads it (resolve-window-ctx.ts).
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
