// The body of /inbox: the open items sitting in a phase's cross-phase inbox — bare, the ACTIVE
// phase's; a phase name, that one phase's; `all`, every phase's. Split out of inbox.ts, which is now
// the assembler that registers it.
//
// OPEN items only. `all` on this command means every PHASE, not every status — the model's
// inbox_read(status) already uses "all" for "including resolved", and one word meaning two things
// across the product is exactly the drift the closed phase set exists to prevent.

import { canonicalizePhase } from '../../core/session/canonicalize-phase.js';
import { readInbox } from '../../core/session/read-inbox.js';
import type { Phase } from '../../core/session/phase.type.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import { formatLocalStamp } from './format-local-stamp.js';
import { writeFittedLine } from './write-fitted-line.js';
import { writePhaseBlock } from './write-phase-block.js';
import { writeWrappedLines } from './write-wrapped-lines.js';

/** The slice of the orchestrator /inbox needs — satisfied structurally by SessionOrchestrator. */
export interface InboxOrchestrator {
  readonly projectPath: string;
  /** The session's active phase (lowercase in-code; canonicalized against the closed six here). */
  readonly activePhase: string;
}

/**
 * The six phases in lifecycle order — the order `/inbox all` walks them in.
 *
 * Deliberately `as const satisfies readonly Phase[]` rather than annotated `readonly Phase[]`: the
 * literal tuple type is what makes the exhaustiveness guard below non-vacuous, and a widened
 * annotation would reduce `Exclude<Phase, …>` to `never` for free.
 */
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

/** Print the open inbox items for `args[0]` — a phase name, `all`, or (bare) the active phase. */
export function showInbox(args: readonly string[], orch: InboxOrchestrator): void {
  const selector = (args[0] ?? '').trim();

  // `all` — every phase's inbox, empty ones included: "the Worker has nothing waiting" is an answer,
  // and a listing that omitted the quiet phases would look like they have no inbox at all.
  if (selector.toLowerCase() === 'all') {
    writeFittedLine('', theme.meta);
    writeFittedLine('Open inbox items, every phase:', theme.strong);
    writeFittedLine('', theme.meta);
    let total = 0;
    // writePhaseBlock: one phase's open items as a titled block, returning how many it printed — so
    // the total below can never disagree with the rows above it.
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
