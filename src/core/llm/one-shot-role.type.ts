// The other half of the closed call-role set (see call-role.type.ts). A ONE-SHOT holds no history and
// no tools and is discarded when it answers (docs/mental-model.md), which is what makes it cheap: it
// carries none of the phase markdown or tool schemas that are 29-44% of an ordinary window.
//
// Only a one-shot may be handed to `oneShot`, so this sub-union is what stops a one-shot claiming to
// be a Worker and quietly taking the Worker's ceiling.

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
