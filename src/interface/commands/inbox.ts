// /inbox [<phase>|all] — the open items sitting in a phase's cross-phase inbox. Bare, it is the
// ACTIVE phase's; a phase name is that one phase's; `all` is every phase's.
//
// The inbox is otherwise a channel only the model can see, which makes it impossible to tell from
// outside whether the protocol is being followed at all — whether a phase actually reads its inbox at
// phase start and posts a concern when it spots one. This is the window onto that.
//
// A pure read of the same JSONL files the model's inbox_read tool folds, and deliberately NOT a way
// to write: a phase that needs its own inbox has `inbox_read`, posting belongs to `inbox_post`, and
// closing an item is `inbox_resolve` — a one-line note by whoever actually dealt with it. There is no
// user-side resolve here, because a user closing an item the model never saw would be a lie in the
// record (docs/phases.md).
//
// OPEN items only. `all` on this command means every PHASE, not every status — the model's
// inbox_read(status) already uses "all" for "including resolved", and one word meaning two things
// across the product is exactly the drift the closed phase set exists to prevent.

import { canonicalizePhase } from '../../core/session/canonicalize-phase.js';
import { readInbox } from '../../core/session/read-inbox.js';
import type { InboxItem } from '../../core/session/inbox-item.type.js';
import type { Phase } from '../../core/session/phase.type.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import type { Command } from '../command.type.js';
import { formatLocalStamp } from './format-local-stamp.js';
import { writeFittedLine } from './write-fitted-line.js';
import { writeWrappedLines } from './write-wrapped-lines.js';

/** The slice of the orchestrator /inbox needs — satisfied structurally by SessionOrchestrator. */
export interface InboxOrchestrator {
  readonly projectPath: string;
  /** The session's active phase (lowercase in-code; canonicalized against the closed six here). */
  readonly activePhase: string;
}

/** The six phases in lifecycle order — the order `/inbox all` walks them in. */
const PHASE_ORDER = ['Discovery', 'Design', 'Breakdown', 'Worker', 'Reviewer', 'Retro'] as const satisfies readonly Phase[];

/**
 * Compile-time exhaustiveness guard, checked where it is DECLARED (an unused alias is still checked).
 * A seventh phase added to the `Phase` union but not to PHASE_ORDER above fails the `never`
 * constraint and breaks the build — instead of letting `/inbox all` quietly stop showing one phase's
 * inbox, which is the single failure this command exists to make impossible.
 */
type AssertNever<T extends never> = T;
type EveryPhaseIsListed = AssertNever<Exclude<Phase, (typeof PHASE_ORDER)[number]>>;
/** Names the guard once so it reads as load-bearing rather than as an alias nobody uses. */
export type InboxPhaseCoverage = EveryPhaseIsListed;

/** The six names as the user types them, for the "you asked for something else" hint. */
const PHASE_HINT = PHASE_ORDER.join(', ').toLowerCase();

/** One phase's open items as a titled block; returns how many it printed. */
function writePhaseBlock(projectPath: string, phase: Phase, showEmpty: boolean): number {
  // readInbox: replay THIS phase's own JSONL, fold posts + resolves, keep only the unresolved ones.
  const items: InboxItem[] = readInbox(projectPath, phase, 'open');
  if (items.length === 0) {
    if (showEmpty) writeFittedLine(`  ${phase}: no open items`, theme.meta);
    return 0;
  }
  writeFittedLine(`  ${phase} (${items.length} open):`, theme.strong);
  for (const item of items) {
    writeFittedLine(`    #${item.id}  from ${item.from}  ·  ${formatLocalStamp(item.created)}`, theme.meta);
    // The body WRAPS rather than being cut: it is a concern one phase raised for another to act on,
    // and the actionable half is as likely to be at the end of it as the start.
    writeWrappedLines(item.body, '      ', theme.meta);
  }
  writeFittedLine('', theme.meta);
  return items.length;
}

function showInbox(args: readonly string[], orch: InboxOrchestrator): void {
  const selector = (args[0] ?? '').trim();

  // `all` — every phase's inbox, empty ones included: "the Worker has nothing waiting" is an answer,
  // and a listing that omitted the quiet phases would look like they have no inbox at all.
  if (selector.toLowerCase() === 'all') {
    writeFittedLine('', theme.meta);
    writeFittedLine('Open inbox items, every phase:', theme.strong);
    writeFittedLine('', theme.meta);
    let total = 0;
    for (const phase of PHASE_ORDER) total += writePhaseBlock(orch.projectPath, phase, true);
    writeFittedLine(total === 0 ? 'Nothing is waiting in any phase.' : `${total} open item(s) across all phases.`, theme.meta);
    writeFittedLine('', theme.meta);
    return;
  }

  // A named phase, else the active one. canonicalizePhase folds any casing onto the canonical name and
  // rejects anything outside the closed six — the single validation point the inbox has.
  const target = selector === '' ? canonicalizePhase(orch.activePhase) : canonicalizePhase(selector);
  if (target === undefined) {
    if (selector === '') {
      renderer.errorLine(`The active phase '${orch.activePhase}' is not one of the six known phases.`);
      return;
    }
    // Split across two lines so neither one has to be cut on a narrow terminal — the hint naming the
    // six phases is the half that makes the error actionable.
    renderer.errorLine(`Unknown phase '${selector}'.`);
    renderer.systemMessage(`Pick one of: ${PHASE_HINT} — or 'all' for every phase's inbox.`);
    return;
  }

  const items = readInbox(orch.projectPath, target, 'open');
  if (items.length === 0) {
    renderer.systemMessage(
      `${target}'s inbox is empty — nothing open.${selector === '' ? ' (/inbox all shows every phase.)' : ''}`,
    );
    return;
  }
  writeFittedLine('', theme.meta);
  writeFittedLine(`${target}'s open inbox items (${items.length}):`, theme.strong);
  writeFittedLine('', theme.meta);
  for (const item of items) {
    writeFittedLine(`  #${item.id}  from ${item.from}  ·  ${formatLocalStamp(item.created)}`, theme.meta);
    writeWrappedLines(item.body, '    ', theme.meta);
    writeFittedLine('', theme.meta);
  }
}

export const inboxCommand: Command = {
  name: 'inbox',
  group: 'session',
  description: "Show the open cross-phase inbox items — the active phase's, one phase's, or every phase's",
  usage: '/inbox [<phase> | all]',
  run: (ctx) => showInbox(ctx.args, ctx.orch),
};
