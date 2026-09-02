// The boot chooser: show every installed model, and let the user pick one of the tool-capable ones.
//
// It replaces `pickSmallestModel` rather than filtering it (OPEN-QUESTIONS.md #1, #10). Nothing infers
// a boot model any more, so this is the only path to a model when state.json cannot supply one — and
// it is a prompt rather than a rule precisely because a rule is what re-pointed an unattended boot.
//
// SHOWN, MARKED, NEVER SELECTABLE. The table above the prompt lists every installed model with
// `(no tools)` beside the ones that cannot call tools (bootModelRows); the prompt itself is offered
// only the capable subset, so a toolless model is visible and explained but cannot be chosen. That is
// the whole of #69/#14's shape at boot; `/models use <name>` carries the other half, where selecting
// one prints why and offers to delete it.
//
// Whatever this prints is wiped moments later by the REPL's one-time clearScreen, which is why the
// marker also has a permanent home in `/models list` — a line printed once at startup is not a surface
// the user can re-open.
//
// The non-TTY guard is load-bearing rather than defensive: @clack/core only takes raw mode when
// `input.isTTY` (dist/index.mjs, `v()`), but it awaits a keypress either way — so on a piped stdin the
// prompt would hang boot forever. Declining there is also the right answer on its own terms: an
// unattended boot must not have a model chosen for it, which is the point of the whole task.

import { stdin } from 'node:process';

import type { InstalledModel } from '../llm/list-models.js';
import { formatSize } from '../ui/format-size.js';
import { renderer } from '../ui/renderer.js';
import { select } from '../ui/select.js';
import { theme } from '../ui/theme.js';
import { write } from '../ui/write.js';
import { bootModelRows } from './boot-model-rows.js';

/**
 * Print `installed` (toolless models marked) and prompt for one of `selectable`. Returns the chosen
 * model's full tag, or undefined when the user declined — Ctrl+C, which is the only cancel gesture
 * @clack/core maps — or when there is no TTY to ask on. A declined chooser is a valid model-less
 * session, not an error: the REPL still boots, so `/models pull` and `/models use` stay reachable.
 *
 * `selectable` is the caller's tool-capable subset (bootModelPlan) and must not be empty; the plan's
 * `none-capable` outcome exists so this is never called with nothing to offer.
 */
export async function chooseBootModel(
  installed: readonly InstalledModel[],
  selectable: readonly InstalledModel[],
): Promise<string | undefined> {
  write('');
  write(theme.strong('Installed models:'));
  write('');
  // bootModelRows: one plain row per model, `(no tools)` on the ones the prompt below will not offer.
  for (const row of bootModelRows(installed)) write(theme.meta(row));
  write('');

  if (!stdin.isTTY) {
    renderer.systemMessage('No TTY to ask on, and nothing is ever selected without you — no model.');
    return undefined;
  }

  write(theme.meta('  Ctrl+C to start without a model.'));
  // select: a single-choice clack list; null on cancel (isCancel is mapped inside it).
  const picked = await select(
    'Which model should this session use?',
    selectable.map((m) => ({ value: m.name, label: m.name, hint: formatSize(m.size) })),
  );
  return picked ?? undefined;
}
