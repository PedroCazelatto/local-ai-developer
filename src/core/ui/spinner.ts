// Thin ora wrapper for the "model is thinking" indicator. The turn loop (task 06) starts it
// after the user submits and stops it the moment the first visible delta arrives — ora writes to
// the same TTY as the streamed text, so stopping late would interleave a spinner frame with
// model output. Stop on first delta, not at turn end.

import ora, { type Ora } from 'ora';

let spinner: Ora | null = null;

/** Start the thinking spinner (idempotent — a second call is a no-op).
 *
 * `discardStdin: false` is load-bearing: ora's default stdin discarder toggles the TTY raw mode
 * and calls `process.stdin.pause()` when the spinner STOPS. Our persistent REPL runs a
 * `readline/promises` interface on that SAME stdin, so letting ora pause/raw-toggle it desyncs
 * readline — after the first turn the next `rl.question` never gets live stdin, the event loop
 * empties, and Node exits 0 ("the app just finished after one response"). We own stdin via
 * readline, so ora must not touch it. */
export function startThinking(): void {
  if (spinner) return;
  spinner = ora({ text: 'thinking…', spinner: 'dots', discardStdin: false }).start();
}

/** Stop and clear the spinner (idempotent). Call before writing the first streamed delta. */
export function stopThinking(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
