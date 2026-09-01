// Offer to pull a model the user's saved choice names but the daemon no longer has.
//
// The saved `activeModel` is a PREFERENCE, not a guarantee: the blob can be deleted, or state.json can
// be carried to a machine that never pulled it. Boot asks rather than silently falling back, because
// silently running a different model than the one the user chose is the kind of thing nobody notices
// until the output is wrong.

import process from 'node:process';
import { confirmKey } from '../ui/confirm-key.js';
import { pullWithSpinner } from '../ui/pull-with-spinner.js';

/**
 * Offer to pull `name` and, if the user accepts, run it to completion. The caller prints the line that
 * NAMES the model first, so the prompt itself is just "Download it now?". `process` is the SIGINT source:
 * this runs before any readline exists, so Ctrl-C reaches us as a plain process signal. Returns true only
 * when the blob is actually on disk afterwards — a declined offer, a Ctrl-C mid-pull, and a failed pull
 * are all just "no" to the caller (pullWithSpinner reports the cancel/error itself).
 */
export async function offerPull(name: string): Promise<boolean> {
  // confirmKey blocks on one y/n keystroke (no Enter); false on n / Esc / Ctrl-C / non-TTY.
  if (!(await confirmKey('Download it now?'))) return false;
  return (await pullWithSpinner(name, process)) === 'ok';
}
