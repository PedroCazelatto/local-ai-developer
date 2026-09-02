// The git_branch actions as a runtime list, for narrowing an untyped argument and for naming the legal
// values back to the model. A VALUE, so it is a plain constant module rather than a .type.ts -- the same
// shape core/session/severities.ts and retro-scopes.ts take.
//
// It is a module of its own rather than a constant inside git-branch.ts because is-branch-action.ts
// needs it at RUNTIME: leaving it in the tool file would put a real value cycle between the two.

import type { BranchAction } from './branch-action.type.js';

/** The legal `action` values, in the order the tool's error message lists them. */
export const BRANCH_ACTIONS: readonly BranchAction[] = ['create', 'switch', 'list'];
