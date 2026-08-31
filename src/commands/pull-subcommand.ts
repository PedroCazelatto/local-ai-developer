// `/models pull <name>` (V5/02) — the streamed, Ctrl-C-abortable download against the HOST Ollama
// daemon. BLOCKS until the pull finishes.

import { pullWithSpinner } from '../core/ui/pull-with-spinner.js';
import * as renderer from '../core/ui/renderer.js';
import type { CommandContext } from '../interface/command-registry.js';

/**
 * `/models pull <name>` — stream the pull, then point the user at `/models use` on success.
 * pullWithSpinner runs a live ora line and BLOCKS until the pull finishes (the REPL is single-threaded,
 * so nothing else runs until it resolves), reporting a cancel/error itself and leaving 'ok' to us to
 * phrase. `ctx.rl` is the SIGINT source: readline emits its own 'SIGINT' on Ctrl-C while the interface is
 * live (it owns the TTY), so the abort stays scoped to this pull and the REPL survives it.
 */
export async function pullSubcommand(ctx: CommandContext, name: string | undefined): Promise<void> {
  if (name === undefined || name === '') {
    renderer.errorLine('Usage: /models pull <name>');
    return;
  }
  if ((await pullWithSpinner(name, ctx.rl)) === 'ok') {
    renderer.systemMessage(`Pulled ${name}. Switch to it with  /models use ${name}`);
  }
}
