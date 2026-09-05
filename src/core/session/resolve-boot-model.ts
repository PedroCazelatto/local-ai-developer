// Resolve which model the session boots on, against what Ollama ACTUALLY has installed.
//
// Supersedes the old `state.json → DEFAULT_MODEL` guess, which never asked the daemon anything: on a
// fresh install it locked the session to a hard-coded name that was not pulled, so every turn failed and
// the user could not even start chatting. There is no safe hard-coded default — only the installed set
// is ground truth. SUGGESTED_MODEL survives purely as a DOWNLOAD SUGGESTION for the empty case.
//
// The rules, in order:
//   1. state.json's activeModel, if it is installed        → the user's own last explicit choice wins.
//   2. state.json's activeModel, if it is NOT installed     → offer to re-pull it (y/n).
//   3. otherwise, the smallest installed model              → the VRAM-safest thing that exists.
//   4. nothing installed at all                             → offer to pull SUGGESTED_MODEL (y/n).
//   5. every offer declined                                 → undefined; the REPL boots model-less and
//                                                             prints the pull hint (repl.ts).
// A declined pull is never followed by a second offer for a different model — one ask per boot.

import process from 'node:process';

import { listModels, matchesModelName, pickSmallestModel } from '../llm/index.js';
import { confirmKey } from '../ui/confirm-key.js';
import { pullWithSpinner } from '../ui/pull-with-spinner.js';
import { renderer } from '../ui/renderer.js';
import { loadAppState } from './load-app-state.js';
import { SUGGESTED_MODEL } from './config.js';

/**
 * Offer to pull `name` and, if the user accepts, run it to completion. The caller prints the line that
 * NAMES the model first, so the prompt itself is just "Download it now?". `process` is the SIGINT source:
 * this runs before any readline exists, so Ctrl-C reaches us as a plain process signal. Returns true only
 * when the blob is actually on disk afterwards — a declined offer, a Ctrl-C mid-pull, and a failed pull
 * are all just "no" to the caller (pullWithSpinner reports the cancel/error itself).
 */
async function offerPull(name: string): Promise<boolean> {
  // confirmKey blocks on one y/n keystroke (no Enter); false on n / Esc / Ctrl-C / non-TTY.
  if (!(await confirmKey('Download it now?'))) return false;
  return (await pullWithSpinner(name, process)) === 'ok';
}

/**
 * The model the session should boot on, or undefined when none is available and the user declined to pull
 * one (a model-less REPL is a valid state — the user can still run `/models pull|use`).
 *
 * THROWS if the Ollama daemon is unreachable: boot needs the installed list to decide anything, and a
 * session with no daemon can do nothing at all, so index.ts treats it as fatal exactly like a missing
 * Docker daemon. Any prompt printed here is answered live by the user, before the REPL's one-time
 * clearScreen wipes the boot scrollback; the OUTCOME stays visible in the status line (or, when nothing
 * was selected, in the hint the REPL prints after its header).
 */
export async function resolveBootModel(): Promise<string | undefined> {
  const installed = await listModels();
  const saved = loadAppState().activeModel;

  if (saved !== undefined) {
    if (installed.some((m) => matchesModelName(m.name, saved))) return saved;
    // The user picked this model before and it is gone (deleted, or pulled on another machine). Their
    // explicit choice outranks our inferred one, so offer to restore it before falling back.
    renderer.systemMessage(`Saved model '${saved}' isn't installed.`);
    if (await offerPull(saved)) return saved;
    // Declined: fall back to the pick rule. If nothing else is installed we stop here rather than chain
    // a second offer — they just said no to downloading.
    return pickSmallestModel(installed)?.name;
  }

  // pickSmallestModel: the smallest installed model by on-disk bytes (VRAM-safest), or undefined if none.
  const smallest = pickSmallestModel(installed);
  if (smallest !== undefined) return smallest.name;

  renderer.systemMessage(`No models are installed. Suggested: ${SUGGESTED_MODEL}`);
  return (await offerPull(SUGGESTED_MODEL)) ? SUGGESTED_MODEL : undefined;
}
