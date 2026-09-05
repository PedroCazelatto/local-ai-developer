// The `/swap` run handler: validate the phase argument, switch, and say what the active phase now is.
// Split out of swap.ts, whose object already carried the one-line `complete:` arrow — a second inline
// arrow beside it would be a second declaration.
//
// It takes the whole CommandContext rather than a narrowed orchestrator slice because that is exactly
// what the arrow it replaces received; introducing a `SwapOrchestrator` here would be inventing a
// contract the command never had.

import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import { renderer } from '../../core/ui/renderer.js';
import type { CommandContext } from '../command-context.type.js';

/** Switch the active phase to `ctx.args[0]`, or print the usage line naming the phases that exist. */
export function swapPhase(ctx: CommandContext): void {
  const target = ctx.args[0];
  if (target === undefined || target === '') {
    renderer.errorLine(`Usage: /swap <phase>. Available: ${ctx.orch.availablePhases().join(', ')}`);
    return;
  }
  try {
    // switchPhase throws a clear Error on an unknown phase; catch it into a recoverable line so the REPL survives.
    ctx.orch.switchPhase(target);
    renderer.systemMessage(`→ phase: ${ctx.orch.activePhase}`);
  } catch (err) {
    renderer.errorLine(errMessage(err));
  }
}
