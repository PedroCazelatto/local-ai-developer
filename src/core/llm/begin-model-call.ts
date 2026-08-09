// Open the abort lifetime for ONE model call: an AbortSignal the caller bridges onto the real request,
// a stall watchdog behind it, and the record of why it ended.
//
// The watchdog is deliberately a STALL timer, not a wall-clock cap on the turn. On one 3060 a 14–32b
// model can spend many minutes on a single legitimate turn, so a total cap would kill healthy work; what
// actually needs surfacing is a daemon that has gone quiet. Every arriving chunk calls touch() and
// restarts the timer, so only silence trips it. A non-streamed call has nothing to touch — its whole
// response arrives at once — so there the same timer becomes a total call timeout, which is the only
// thing measurable on that path.

import type { ModelCallLifetime } from './begin-model-call.type.js';
import type { TurnAbortReason } from './turn-aborted-error.type.js';

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
