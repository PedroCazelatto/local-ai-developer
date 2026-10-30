// The batch's pre-flight gate: the two states in which starting an unattended run would be wrong.
//
// Both refusals are about work that a HUMAN has to look at before hours of autonomous execution bury
// it -- an unreviewed Retro patch to the orchestrator's own instructions, and uncommitted changes that
// the first task's commit would otherwise sweep up. Refusing is cheap; discovering either the next
// morning is not.

import { isWorkingTreeDirty } from './is-working-tree-dirty.js';
import { rulesPhasesDirty } from './rules-phases-dirty.js';

/** Pre-flight refusal: an unreviewed Retro systemic patch sits uncommitted in the orchestrator repo. */
const PREFLIGHT_RULES_WARNING =
  'the orchestrator repo has uncommitted rules/phases/ changes (an unreviewed Retro systemic patch). ' +
  "Review and commit it manually before running a batch — the orchestrator's own instructions must " +
  'never mutate silently (constitution).';

/** Pre-flight refusal: the project tree is dirty, so no task review could be isolated. */
const PREFLIGHT_DIRTY_WARNING =
  'the project working tree has uncommitted changes, so no task review can be isolated. Commit or stash ' +
  'them first (right after /new-project, commit the scaffold + backlog + PRODUCT_SPEC), then re-run.';

/** A pre-flight refusal reason, or undefined when the batch may start. */
export function preflightRefusal(projectPath: string): string | undefined {
  if (rulesPhasesDirty()) return `Refusing to start the batch: ${PREFLIGHT_RULES_WARNING}`;
  if (isWorkingTreeDirty(projectPath)) return `Refusing to start the batch: ${PREFLIGHT_DIRTY_WARNING}`;
  return undefined;
}
