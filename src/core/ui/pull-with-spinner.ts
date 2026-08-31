// A streamed model pull rendered as a live ora line, abortable with Ctrl-C. Shared by `/models pull|use`
// (inside the REPL) and by the boot model resolution (before any REPL exists) — hence the injected
// SigintSource rather than a hard-wired readline or process handler.

import ora from 'ora';

import { errMessage } from '../err-message.js';
import { pullModel } from '../llm/pull-model.js';
import { pullProgressText } from './pull-progress-text.js';
import * as renderer from './renderer.js';

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

/**
 * Stream a pull with a live ora line and BLOCK until it finishes, returning the outcome without printing
 * a final line — the caller owns that message. Ctrl-C aborts ONLY this pull: a one-shot SIGINT listener
 * on `sigint` trips an AbortController whose signal pull-model bridges onto the streamed request.
 * `discardStdin: false` matches spinner.ts — a live REPL owns stdin via readline, so ora must not
 * pause/raw-toggle it. `cancelled` and `error` are reported here; `ok` is left for the caller to phrase.
 */
export async function pullWithSpinner(name: string, sigint: SigintSource): Promise<PullResult> {
  const controller = new AbortController();
  const onSigint = (): void => controller.abort();
  sigint.once('SIGINT', onSigint);

  const spinner = ora({ text: `pulling ${name}…`, spinner: 'dots', discardStdin: false }).start();
  try {
    // pullModel streams progress and resolves only when the pull completes or is aborted (cancelled:true).
    const outcome = await pullModel(name, (p) => (spinner.text = pullProgressText(name, p)), controller.signal);
    spinner.stop();
    if (outcome.cancelled) {
      renderer.systemMessage(`Pull of ${name} cancelled (a partial blob is Ollama's to clean up).`);
      return 'cancelled';
    }
    return 'ok';
  } catch (err) {
    spinner.stop();
    // errMessage: an Error's message, or the thrown value stringified.
    renderer.errorLine(`Couldn't pull ${name}: ${errMessage(err)}`);
    return 'error';
  } finally {
    sigint.removeListener('SIGINT', onSigint);
  }
}
