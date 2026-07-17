// A streamed model pull rendered as a live ora line, abortable with Ctrl-C. Shared by `/models pull|use`
// (inside the REPL) and by the boot model resolution (before any REPL exists) — hence the injected
// SigintSource rather than a hard-wired readline or process handler.

import ora from 'ora';

import { pullModel } from '../llm/ollama-models.js';
import type { PullProgress } from '../llm/ollama-models.type.js';
import { formatSize } from './format-size.js';
import type { PullResult, SigintSource } from './pull-with-spinner.type.js';
import * as renderer from './renderer.js';

/** Live status line for a streamed pull event (some events carry no byte totals — show just the status). */
function progressText(name: string, p: PullProgress): string {
  const status = p.status ?? '';
  if (p.total > 0 && p.completed >= 0) {
    const pct = Math.floor((p.completed / p.total) * 100);
    return `pulling ${name} · ${status} · ${pct}% (${formatSize(p.completed)}/${formatSize(p.total)})`;
  }
  return `pulling ${name} · ${status}`;
}

/**
 * Stream a pull with a live ora line and BLOCK until it finishes, returning the outcome without printing
 * a final line — the caller owns that message. Ctrl-C aborts ONLY this pull: a one-shot SIGINT listener
 * on `sigint` trips an AbortController whose signal ollama-models bridges onto the streamed request.
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
    const outcome = await pullModel(name, (p) => (spinner.text = progressText(name, p)), controller.signal);
    spinner.stop();
    if (outcome.cancelled) {
      renderer.systemMessage(`Pull of ${name} cancelled (a partial blob is Ollama's to clean up).`);
      return 'cancelled';
    }
    return 'ok';
  } catch (err) {
    spinner.stop();
    renderer.errorLine(`Couldn't pull ${name}: ${err instanceof Error ? err.message : String(err)}`);
    return 'error';
  } finally {
    sigint.removeListener('SIGINT', onSigint);
  }
}
