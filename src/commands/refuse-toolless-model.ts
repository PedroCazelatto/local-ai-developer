// `/models use <name>` on a model that cannot call tools: refuse, explain, and offer to delete it
// (OPEN-QUESTIONS.md #69, which overrides the earlier #11c reading of a confirm-then-switch).
//
// The full shape, across both surfaces that show models: a toolless model is SHOWN, MARKED, and NOT
// SELECTABLE — and selecting one prints the reason it is unavailable and asks whether to delete it. So
// it is visible, explained, and disposable, never silently active and never something the user has to
// keep remembering about.
//
// Refusing rather than warning is the point. Every phase here is a tool-calling loop, so a model
// without `tools` is not slower, it is structurally incapable: the phase burns its five rounds looking
// confused instead of failing. That is the line between this marker and the "too heavy" one, which
// marks without refusing — a slow model is the user's choice to make; an incapable one is not.

import { errMessage } from '../core/err-message.js';
import { deleteModel } from '../core/llm/delete-model.js';
import { confirmKey } from '../core/ui/confirm-key.js';
import { NO_TOOLS_MARKER } from '../core/ui/no-tools-marker.js';
import { renderer } from '../core/ui/renderer.js';

/**
 * Say why `name` cannot be used, then offer to delete it on a single keystroke. `name` must be the
 * FULL tag as the daemon lists it, because that is what deleteModel deletes. The session's model is
 * untouched either way — a toolless model can never have been the active one, so there is nothing to
 * restore. A failed delete is one recoverable line, not a throw: the refusal has already landed.
 */
export async function refuseToollessModel(name: string): Promise<void> {
  renderer.errorLine(`'${name}' can't call tools, so it can't run any phase — not switching to it.`);
  renderer.systemMessage('  Every phase is a tool-calling loop; a Worker that cannot call edit_file does nothing at all.');
  // confirmKey blocks on one y/n keystroke (no Enter); false on n / Esc / Ctrl-C / non-TTY, so the
  // irreversible branch is never the default and an unattended session never deletes anything.
  if (!(await confirmKey(`Delete '${name}' from Ollama?`))) {
    renderer.systemMessage(`  Kept it. It stays listed and marked ${NO_TOOLS_MARKER} — see  /models list`);
    return;
  }
  try {
    // deleteModel removes the blob from the HOST daemon — the one irreversible thing /models can do.
    await deleteModel(name);
    renderer.systemMessage(`  Deleted '${name}'.`);
  } catch (err) {
    renderer.errorLine(`  Couldn't delete '${name}': ${errMessage(err)}`);
  }
}
