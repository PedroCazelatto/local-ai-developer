// The body of /resume: reopen an address directly, or list the recent contexts and ask for a number.
// Split out of resume.ts, which is now the assembler that registers it — and which owns the plain
// `resume` stem in this folder, so this file carries what it reopens in its name.
//
// The pick prompt reuses the REPL's own readline (the REPL owns stdin; fighting @clack for it is the
// pattern render-verdict.ts warns against), then repaints the pinned status bar the prompt drew over.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import { shortContextId } from '../../core/session/index.js';
import { capitalizePhase } from '../../core/ui/capitalize-phase.js';
import { renderer } from '../../core/ui/renderer.js';
import { statusBar } from '../../core/ui/status-bar.js';
import { contextAddress } from './context-address.js';
import { renderContextList } from './render-context-list.js';
import { reopenContext } from './reopen-context.js';
import type { ResumeOrchestrator } from './resume-orchestrator.type.js';
import { turnLabel } from './turn-label.js';

/** How many of the phase's recent contexts a bare `/resume` lists before asking for a number. */
const MAX_LISTED = 5;

/** Reopen `args[0]` if given, else list the recent contexts and reopen the number the user picks. */
export async function resumeContext(orch: ResumeOrchestrator, rl: ReadlineInterface, args: string[]): Promise<void> {
  const phase = orch.activePhase;

  // `/resume <address>` — a full UUID or any unique prefix, with or without the `<phase>/` label the
  // listing prints. Strip the label so a user can paste back exactly what they were shown.
  const typed = args[0];
  if (typed !== undefined && typed.trim() !== '') {
    const bare = typed.includes('/') ? (typed.split('/').pop() ?? '') : typed;
    // reopenContext: replays the context, reports it, and warns if it was written for a smaller window.
    reopenContext(orch, bare, `${phase}/${shortContextId(bare)}`);
    return;
  }

  const contexts = orch.activePhaseContexts(MAX_LISTED);
  if (contexts.length === 0) {
    // capitalizePhase: phase ids are lowercase in-code; display them Titlecased.
    renderer.systemMessage(`No earlier contexts for ${capitalizePhase(phase)}`);
    return;
  }

  // renderContextList: the numbered list — address, last activity, turns, tokens, models, title, and
  // the smaller-ceiling mark plus its legend.
  renderContextList(phase, contexts, orch.numCtx);

  // Reuse the REPL's readline for the pick; repaint the bar the prompt's ESC[0J erased (as run-repl.ts does).
  const answer = (await rl.question(`Pick 1-${contexts.length} to reopen, anything else to cancel: `)).trim();
  statusBar.repaint();

  const pick = Number(answer);
  const chosen = Number.isInteger(pick) && pick >= 1 && pick <= contexts.length ? contexts[pick - 1] : undefined;
  if (chosen === undefined) {
    renderer.systemMessage('Cancelled — nothing reopened.');
    return;
  }
  const described = chosen.title === null ? contextAddress(chosen) : `${contextAddress(chosen)} "${chosen.title}"`;
  reopenContext(orch, chosen.id, `${described} · ${turnLabel(chosen.turnCount)}`);
}
