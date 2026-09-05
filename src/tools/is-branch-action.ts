// Narrow an untyped `action` argument to one of git_branch's three operations.
//
// It checks against the runtime list rather than a union of its own, so the guard and the message that
// names the legal values back to the model cannot drift apart. `isAction` was adequate while it was
// private inside git-branch.ts; as a file name it would have collided head-on with git-stash.ts's own
// `isAction`, which has the same BODY TEXT and a different meaning -- it closes over a different list
// and narrows to a different union. Two same-named files, two different functions: a false friend.

import type { BranchAction } from './branch-action.type.js';
import { BRANCH_ACTIONS } from './branch-actions.js';

/** True when `value` is one of git_branch's three actions. */
export function isBranchAction(value: unknown): value is BranchAction {
  return typeof value === 'string' && (BRANCH_ACTIONS as readonly string[]).includes(value);
}
