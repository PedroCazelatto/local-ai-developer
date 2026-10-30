// What reopening a context reports back, so the orchestrator can emit a `memory_load` event.

import type { ContextSummary } from './context-summary.type.js';

/**
 * What reopening a context reports back, so the orchestrator can emit a `memory_load` event.
 * `lastPromptTokens` is the most recent persisted prompt_eval_count — the EXACT restored context size
 * — or null if none was ever recorded (never estimated).
 */
export interface PhaseLoad {
  readonly contextId: string;
  /** Visible turns rebuilt into the prompt by the reopen. */
  readonly turns: number;
  readonly lastPromptTokens: number | null;
  /**
   * The reopened context's own listing row, carried out rather than re-read: `/resume <address>` has no
   * listing to take it from, and it needs `numCtx` to say whether the restored history was written for a
   * smaller window. NOT nullable — the row was resolved one statement earlier on the same connection, so
   * a miss here is a database contradicting itself and SessionMemory throws rather than reporting it as
   * "no such context", which would tell the user nothing was reopened when something was.
   */
  readonly summary: ContextSummary;
}
