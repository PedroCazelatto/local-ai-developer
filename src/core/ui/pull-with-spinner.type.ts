// Types for pull-with-spinner.ts (constitution: types live beside the function they serve).

/**
 * Whatever emits `SIGINT` for the Ctrl-C that aborts a pull. Two callers, two emitters: inside the REPL
 * it is the live `readline` interface (which owns the TTY and emits its own 'SIGINT'), and at boot —
 * before any readline exists — it is `process` itself. Both satisfy this structurally, so the pull does
 * not care which context it runs in.
 */
export interface SigintSource {
  once(event: 'SIGINT', listener: () => void): unknown;
  removeListener(event: 'SIGINT', listener: () => void): unknown;
}

/** Outcome of a streamed pull, so callers decide the follow-up (print a hint vs. switch to the model). */
export type PullResult = 'ok' | 'cancelled' | 'error';
