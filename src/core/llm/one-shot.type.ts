// Result of a one-shot, history-free Ollama call (oneShot, V4/02): the model's text reply plus the
// EXACT token counts Ollama reported for that single throwaway call. Sibling type file (constitution).
// Nulls in `tokens` mean Ollama omitted the metric (see TokenCounts) — never a length-based guess.

import type { TokenCounts } from './types.js';

export interface OneShotResult {
  /** The model's full text reply. A one-shot requests no tools, so there are no tool calls to handle. */
  readonly content: string;
  /** EXACT prompt/eval counts for THIS call — for auditing its cost, kept off the session status line. */
  readonly tokens: TokenCounts;
}
