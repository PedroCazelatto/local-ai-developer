// The one error every aborted model call surfaces as, so callers can tell "the user stopped this" and
// "the daemon went quiet" apart from a genuine Ollama/network failure without string-matching a message.
//
// Thrown by OllamaClient for BOTH paths — the streamed turn (out of the deltas iterator) and the
// non-streamed one-shot — so a single `instanceof` check at the turn loop covers every window: the
// interactive phases, the Worker, the Reviewer, Retro, sub-agents, and the throwaway one-shot callers.

import type { TurnAbortReason } from './turn-aborted-error.type.js';

/** A model call that ended because it was cancelled or timed out, never because Ollama itself failed. */
export class TurnAbortedError extends Error {
  /** `user` (Ctrl+C) or `timeout` (no bytes within the configured window) — see the type's own note. */
  readonly reason: TurnAbortReason;

  constructor(reason: TurnAbortReason, timeoutMs: number) {
    super(
      reason === 'user'
        ? 'The turn was cancelled.'
        : `Ollama sent nothing for ${Math.round(timeoutMs / 1000)}s — the call was abandoned. ` +
            'Check that the daemon is up (`ollama ps`), then try again.',
    );
    // Set explicitly: extending a built-in loses the subclass name through TypeScript's ES2022 output,
    // and this name reaches the user through the REPL's error line.
    this.name = 'TurnAbortedError';
    this.reason = reason;
  }
}
