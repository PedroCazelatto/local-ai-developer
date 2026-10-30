// `/models use <name>` (V5/02) — switch the live session model, offering to download it first when it
// isn't pulled yet, and REFUSING it outright when it cannot call tools. The model never picks its own
// runtime, so this is a user command and never a tool.
//
// It reads listModels rather than hasModel because presence is no longer the only question: the same
// `/api/tags` round trip answers "is it here?" and "can it call tools?", and hasModel's own header
// says a caller that needs the list should match against it directly rather than re-list.

import { listModels } from '../core/llm/list-models.js';
import { matchesModelName } from '../core/llm/matches-model-name.js';
import { supportsTools } from '../core/llm/supports-tools.js';
import { confirmKey } from '../core/ui/confirm-key.js';
import { pullWithSpinner } from '../core/ui/pull-with-spinner.js';
import { renderer } from '../core/ui/renderer.js';
import type { CommandContext } from '../interface/command-context.type.js';
import { applyModel } from './apply-model.js';
import { refuseToollessModel } from './refuse-toolless-model.js';

/**
 * `/models use <name>` — switch the live session model. Two gates, in this order:
 *
 * NOT PULLED: we don't error. We ask "Download it now? (y/n)" answered by a SINGLE keystroke (no
 * Enter, via confirmKey), and on `y` pull it (blocking, Ctrl-C-abortable). On `n`/cancel we leave the
 * current model in place. A merely-started pull still counts as not-present.
 *
 * TOOLLESS: refused, with the reason and an offer to delete it (OPEN-QUESTIONS.md #69) — never a
 * warning-then-switch. This applies to a model that was JUST pulled too, which is why the capability
 * is re-read from a fresh listModels after a pull rather than assumed: a new blob's capabilities are
 * not knowable before the daemon has it, and downloading a model does not make it able to call tools.
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

  // listModels asks the daemon for every installed model — name, size, digest and capabilities — in
  // one call; matchesModelName holds the tag rule (exact, or the implicit `:latest` when tagless).
  let match = (await listModels()).find((m) => matchesModelName(m.name, name));

  if (match === undefined) {
    // confirmKey blocks on one y/n keystroke (no Enter); false on n / Esc / Ctrl-C / non-TTY.
    const wantsPull = await confirmKey(`Model '${name}' isn't pulled. Download it now?`);
    if (!wantsPull) {
      const current = ctx.orch.model;
      renderer.systemMessage(
        current === undefined ? 'Still no model selected.' : `Kept current model — still using ${current}.`,
      );
      return;
    }
    // pullWithSpinner reports cancel/error itself; only 'ok' means the blob is present.
    if ((await pullWithSpinner(name, ctx.rl)) !== 'ok') return;
    match = (await listModels()).find((m) => matchesModelName(m.name, name));
    if (match === undefined) {
      // Surfaced rather than papered over: the pull reported success and the daemon does not list it,
      // so there is nothing here we can honestly gate on.
      renderer.errorLine(`Pulled '${name}', but the daemon doesn't list it — not switching.`);
      return;
    }
  }

  // supportsTools is the gate; an unreadable capabilities field reads as [] and fails it (fail-closed).
  if (!supportsTools(match.capabilities)) {
    // refuseToollessModel says why and offers to delete the blob on a single keystroke.
    await refuseToollessModel(match.name);
    return;
  }

  // applyModel switches the live session model and persists it to state.json (best-effort).
  applyModel(ctx, name);
}
