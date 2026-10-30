// Open the abort lifetime for ONE model call: an AbortSignal the caller bridges onto the real request,
// a stall watchdog behind it, and the record of why it ended.
//
// The watchdog is deliberately a STALL timer, not a wall-clock cap on the turn. On one 3060 a 14–32b
// model can spend many minutes on a single legitimate turn, so a total cap would kill healthy work; what
// actually needs surfacing is a daemon that has gone quiet. Every arriving chunk calls touch() and
// restarts the timer, so only silence trips it. A non-streamed call has nothing to touch — its whole
// response arrives at once — so there the same timer becomes a total call timeout, which is the only
// thing measurable on that path.

import type { TurnAbortReason } from './turn-aborted-error.js';

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

/**
 * Start a call's lifetime with a `timeoutMs` stall window. The returned object is single-use: once
 * settle() has run, cancel() and the watchdog are both dead, so a Ctrl+C racing the end of a call can
 * never abort the NEXT one.
 */
export function beginModelCall(timeoutMs: number): ModelCallLifetime {
  const controller = new AbortController();
  let reason: TurnAbortReason | null = null;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const arm = (): void => {
    clear();
    if (settled) return;
    timer = setTimeout(() => {
      timer = null;
      if (settled) return;
      reason = 'timeout';
      controller.abort();
    }, timeoutMs);
    // unref: a watchdog is not a reason to keep the process alive. Without it a pending timer would
    // hold the event loop open after `/exit` for as long as the stall window has left to run.
    timer.unref();
  };

  arm();

  return {
    signal: controller.signal,
    touch: arm,
    cancel(): void {
      if (settled || controller.signal.aborted) return;
      reason = 'user';
      clear();
      controller.abort();
    },
    settle(): void {
      settled = true;
      clear();
    },
    abortReason(): TurnAbortReason | null {
      return reason;
    },
  };
}
