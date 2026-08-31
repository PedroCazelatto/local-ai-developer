// `/models use <name>` (V5/02) — switch the live session model, offering to download it first when it
// isn't pulled yet. The model never picks its own runtime, so this is a user command and never a tool.

import { hasModel } from '../core/llm/index.js';
import { confirmKey } from '../core/ui/confirm-key.js';
import { pullWithSpinner } from '../core/ui/pull-with-spinner.js';
import { renderer } from '../core/ui/renderer.js';
import type { CommandContext } from '../interface/command-registry.js';
import { applyModel } from './apply-model.js';

/**
 * `/models use <name>` — switch the live session model. If `name` isn't pulled yet, we don't error: we
 * ask "Download it now? (y/n)" answered by a SINGLE keystroke (no Enter, via confirmKey), and on `y`
 * pull it (blocking, Ctrl-C-abortable) and then switch. On `n`/cancel we leave the current model in
 * place. hasModel is the guard so an unknown name never reaches Ollama; a merely-started pull still
 * counts as not-present.
 */
export async function useSubcommand(ctx: CommandContext, name: string | undefined): Promise<void> {
  if (name === undefined || name === '') {
    renderer.errorLine('Usage: /models use <name>');
    return;
  }
  if (name === ctx.orch.model) {
    renderer.systemMessage(`Already using ${name}.`);
    return;
  }
  const present = await hasModel(name);
  if (!present) {
    // confirmKey blocks on one y/n keystroke (no Enter); false on n / Esc / Ctrl-C / non-TTY.
    const wantsPull = await confirmKey(`Model '${name}' isn't pulled. Download it now?`);
    if (!wantsPull) {
      const current = ctx.orch.model;
      renderer.systemMessage(
        current === undefined ? 'Still no model selected.' : `Kept current model — still using ${current}.`,
      );
      return;
    }
    // pullWithSpinner reports cancel/error itself; only 'ok' means the blob is present and we can switch.
    if ((await pullWithSpinner(name, ctx.rl)) !== 'ok') return;
  }
  // applyModel switches the live session model and persists it to state.json (best-effort).
  applyModel(ctx, name);
}
