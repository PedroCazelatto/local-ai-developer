// What boot should DO about the model, decided from the installed set and the saved choice alone.
//
// It is a pure function on purpose: this is the whole of backlog item 6's rule, and the rule is what
// the bug lived in. `pickSmallestModel` used to sort the installed set on disk bytes and take the
// smallest, which on this box landed on deepseek-coder-v2:16b -- `completion,insert`, no tools, and
// the smallest thing installed. Every phase here is a tool-calling loop, so that boot could not run
// the product at all and nothing said so.
//
// The fix is not a better filter. NOTHING INFERS A BOOT MODEL ANY MORE (OPEN-QUESTIONS.md #1, #10):
// a saved choice that is still usable wins, and otherwise the user picks. That removes the class of
// bug rather than one instance of it -- the reason a benchmark pull could silently re-point an
// unattended boot was that something was choosing for the user.
//
// Keeping the rule separate from the prompting and printing is also what makes it testable without a
// daemon or a terminal (constitution, *Testing*).

import type { InstalledModel } from '../llm/list-models.js';
import { matchesModelName } from '../llm/matches-model-name.js';
import { supportsTools } from '../llm/supports-tools.js';

/** Why state.json's `activeModel` was not honoured — there was one, and it did not qualify. */
export interface BootRefusal {
  /** The name as state.json holds it, so the message can quote what the user actually chose. */
  readonly savedName: string;
  /** `missing` — not installed any more; `toolless` — installed, but it cannot call tools. */
  readonly reason: 'missing' | 'toolless';
}

/**
 * What boot should do. `refused` rides along on every outcome except `saved`, because a refused saved
 * model is a thing to SAY as well as a reason to move on — and it can coincide with any of the others
 * (a saved model can be gone from a machine that has nothing else installed either).
 */
export type BootModelPlan =
  /** Boot on this name with no prompt: it is installed and tool-capable. */
  | { readonly outcome: 'saved'; readonly name: string; readonly refused?: undefined }
  /** Nothing is installed. Recommend one, pull NOTHING (#1), and boot model-less. */
  | { readonly outcome: 'empty'; readonly refused?: BootRefusal }
  /** Models are installed but none can call tools (#7). Boot model-less; the REPL still comes up. */
  | { readonly outcome: 'none-capable'; readonly refused?: BootRefusal }
  /** Ask. `selectable` is the tool-capable subset — the only rows a chooser may let through. */
  | {
      readonly outcome: 'choose';
      readonly selectable: readonly InstalledModel[];
      readonly refused?: BootRefusal;
    };

/**
 * Decide the boot model from `installed` (the daemon's list — the only ground truth) and `saved`
 * (state.json's `activeModel`, or undefined). No IO, no prompting, no printing.
 *
 * The ladder, and every rung is a decision rather than a preference:
 *   1. `saved` installed AND tool-capable → `saved`. The user's own explicit choice wins (#9).
 *   2. `saved` installed but toolless     → refused, and fall through. It cannot run a phase.
 *   3. `saved` not installed              → fall through. There is NO re-pull offer (#71 → #10):
 *      with no pick rule left to fall through to, a missing saved model is just an unresolved boot.
 *   4. nothing installed                  → `empty`.
 *   5. nothing tool-capable               → `none-capable`.
 *   6. otherwise                          → `choose`, over the tool-capable subset only.
 */
export function bootModelPlan(
  installed: readonly InstalledModel[],
  saved: string | undefined,
): BootModelPlan {
  // matchesModelName holds the tag rule: the full tag exactly, or the implicit `:latest` when tagless.
  const savedModel =
    saved === undefined ? undefined : installed.find((m) => matchesModelName(m.name, saved));
  // supportsTools is the gate — `tools` in what /api/tags reported, and [] (unreadable) fails it.
  if (saved !== undefined && savedModel !== undefined && supportsTools(savedModel.capabilities)) {
    return { outcome: 'saved', name: saved };
  }

  const refused: BootRefusal | undefined =
    saved === undefined
      ? undefined
      : { savedName: saved, reason: savedModel === undefined ? 'missing' : 'toolless' };

  if (installed.length === 0) return { outcome: 'empty', refused };
  const selectable = installed.filter((m) => supportsTools(m.capabilities));
  if (selectable.length === 0) return { outcome: 'none-capable', refused };
  return { outcome: 'choose', selectable, refused };
}
