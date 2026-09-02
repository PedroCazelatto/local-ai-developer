// Resolve which model the session boots on, against what Ollama ACTUALLY has installed.
//
// Supersedes the old `state.json → DEFAULT_MODEL` guess, which never asked the daemon anything: on a
// fresh install it locked the session to a hard-coded name that was not pulled, so every turn failed and
// the user could not even start chatting. There is no safe hard-coded default — only the installed set
// is ground truth. SUGGESTED_MODEL survives purely as a DOWNLOAD SUGGESTION for the empty case.
//
// AND NOTHING INFERS A MODEL BEHIND THE GATE (backlog item 6, OPEN-QUESTIONS.md #1, #10). The old
// ladder's third rung was `pickSmallestModel` — smallest on disk, on the reasoning that a 3B always
// fits a 3060 — and that pick landed on deepseek-coder-v2:16b here: `completion,insert`, no `tools`,
// and the smallest thing installed. Every phase in this product is a tool-calling loop, so an
// unattended first-run boot could select a model structurally incapable of running any of it, and
// nothing said so until a phase burned its five rounds looking confused. `pickSmallestModel` is
// DELETED rather than filtered: a rule that chooses for the user is the class of bug, not the instance.
//
// The rules, in order (the decision lives in bootModelPlan; this function is its IO):
//   1. state.json's activeModel, installed AND tool-capable → the user's own choice wins, no prompt.
//   2. state.json's activeModel, installed but toolless      → REFUSED, with a line saying why (#9).
//   3. state.json's activeModel, not installed               → say so; there is no re-pull offer any
//                                                              more (#71 → #10), because there is no
//                                                              pick rule left to fall through to.
//   4. otherwise                                             → the user picks (chooseBootModel).
//   5. nothing installed at all                              → recommend one, PULL NOTHING (#1).
//   6. nothing tool-capable, or the chooser declined          → undefined; a model-less REPL, which is
//                                                              a valid session (run-repl.ts).
// Nothing on any of these paths downloads anything: every pull is now an explicit `/models pull`.
//
// IT ALSO OWNS THE ONE PLACE THE VRAM PROBE MAY RUN. Between the installed list and the plan, it asks
// probePendingModels to measure any model this machine has not measured at `numCtx` — loading each one
// and reading `/api/ps`, which is the only way to learn a card's real ceiling (#100c). It must be here
// and nowhere later: probing IS loading, so a probe after boot would evict the session's model
// mid-turn. `numCtx` is a parameter rather than a read off `config` because the ceiling is what the
// measurement is ABOUT, and boot already holds the resolved SessionConfig when it calls this.

import { listModels } from '../llm/list-models.js';
import { renderer } from '../ui/renderer.js';
import { bootModelPlan } from './boot-model-plan.js';
import { chooseBootModel } from './choose-boot-model.js';
import { config } from './config.js';
import { loadAppState } from './load-app-state.js';
import { probePendingModels } from './probe-pending-models.js';

/**
 * The model the session should boot on, or undefined when none is available and nothing was chosen (a
 * model-less REPL is a valid state — the user can still run `/models pull|use`).
 *
 * THROWS if the Ollama daemon is unreachable: boot needs the installed list to decide anything, and a
 * session with no daemon can do nothing at all, so main.ts treats it as fatal exactly like a missing
 * Docker daemon. Any prompt printed here is answered live by the user, before the REPL's one-time
 * clearScreen wipes the boot scrollback; the OUTCOME stays visible in the status line (or, when nothing
 * was selected, in the hint the REPL prints after its header) and in `/models list`.
 */
export async function resolveBootModel(numCtx: number): Promise<string | undefined> {
  // listModels asks the daemon for every installed model — name, size, digest and capabilities — in one
  // /api/tags round trip. main.ts has already refused a daemon too old to report capabilities.
  const installed = await listModels();
  // probePendingModels loads every model this machine has not measured AT THIS CEILING, reads
  // /api/ps, and returns the accumulated cache. THIS IS THE ONLY PLACE IT MAY BE CALLED: probing is
  // loading, so anywhere later would evict the session's model mid-turn. It prints nothing once every
  // row is cached, which is every boot after the first, and it never throws.
  const probes = await probePendingModels(installed, numCtx);
  // bootModelPlan decides, with no IO: honour the saved model, recommend, boot model-less, or ask.
  const plan = bootModelPlan(installed, loadAppState().activeModel);

  if (plan.refused !== undefined) {
    // The user picked this model before and it no longer qualifies. Their explicit choice outranks
    // anything we would infer, so the reason is stated rather than silently stepped over.
    renderer.systemMessage(
      plan.refused.reason === 'missing'
        ? `Saved model '${plan.refused.savedName}' isn't installed any more.`
        : `Saved model '${plan.refused.savedName}' can't call tools, so no phase could run on it.`,
    );
  }

  switch (plan.outcome) {
    case 'saved':
      return plan.name;
    case 'empty':
      // Nothing installed. A suggestion and the exact command, and NOTHING is downloaded: the invariant
      // is that nothing is ever pulled without the user's approval, and there is nobody to ask yet.
      renderer.systemMessage('No models are installed, so this session starts without one.');
      renderer.systemMessage(`  Install one with:  ollama pull ${config.SUGGESTED_MODEL}`);
      renderer.systemMessage('  Or, once the session is up:  /models pull <name>');
      return undefined;
    case 'none-capable':
      // Installed, but none of them can call tools (#7). Model-less is the only outcome that leaves
      // `/models pull` reachable — and the line NAMES NO MODEL (#8): SUGGESTED_MODEL is a suggestion
      // for an EMPTY machine and has not itself been verified tool-capable, so naming it here would
      // only move the problem one pull further along.
      renderer.systemMessage(
        `None of the ${installed.length} installed model${installed.length === 1 ? '' : 's'} can call tools, so this session starts without one.`,
      );
      renderer.systemMessage('  Pull a model with tool support, then  /models use <name>');
      renderer.systemMessage('  /models list  marks which of the installed ones cannot.');
      return undefined;
    case 'choose':
      // chooseBootModel prints every installed model with the toolless ones marked, and prompts over
      // the capable subset only — shown, marked, never selectable. A `(too heavy)` model IS offered:
      // that marker is advice, not a refusal. Undefined if declined.
      return await chooseBootModel(installed, plan.selectable, probes, numCtx);
  }
}
