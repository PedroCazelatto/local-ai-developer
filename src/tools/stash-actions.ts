// The git_stash actions as a runtime list, for narrowing an untyped argument and for naming the legal
// values back to the model. A VALUE, so it is a plain constant module rather than a .type.ts.
//
// It is a module of its own rather than a constant inside git-stash.ts because is-stash-action.ts needs
// it at RUNTIME: leaving it in the tool file would put a real value cycle between the two.

import type { StashAction } from './stash-action.type.js';

/** The legal `action` values, in the order the tool's error message lists them. */
export const STASH_ACTIONS: readonly StashAction[] = ['save', 'list', 'pop', 'drop'];
