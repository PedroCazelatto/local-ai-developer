// Types for begin-model-call.ts (constitution: types live in a sibling file, never inline).

import type { TurnAbortReason } from './turn-aborted-error.type.js';

/**
 * One model call's abort lifetime. Both of OllamaClient's paths hold one of these for the length of a
 * request, and it is the only place that decides WHY a call ended early — so the streamed turn and the
 * non-streamed one-shot cannot drift into disagreeing about what a timeout means.
 */
export interface ModelCallLifetime {
  /** Aborted when the user cancels or the watchdog fires; each path bridges it onto the real request. */
  readonly signal: AbortSignal;
  /**
   * Bytes arrived — restart the watchdog. A STREAM calls this on every chunk, so the timeout measures a
   * stall rather than the turn's length and a slow-but-alive 32b model is never killed for being slow.
   * A non-streamed call never calls it, so the same timer degrades into a total call timeout — which is
   * the only thing that can be measured when the whole response arrives at once.
   */
  touch(): void;
  /** The user asked to stop this call (Ctrl+C). No-op once the call has already been settled. */
  cancel(): void;
  /** The request has settled — stop the watchdog so a pending timer never outlives the call. */
  settle(): void;
  /** Why the call was aborted, or null when it ended on its own. */
  abortReason(): TurnAbortReason | null;
}
