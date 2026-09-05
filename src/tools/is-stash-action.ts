// Narrow an untyped `action` argument to one of git_stash's four shelf operations.
//
// It checks against the runtime list rather than a union of its own, so the guard and the message that
// names the legal values back to the model cannot drift apart. It is NOT a duplicate of
// is-branch-action.ts: the two bodies read identically and mean different things, because each closes
// over its own list and narrows to its own union. Deduping them would have accepted `pop` as a branch
// operation.

import type { StashAction } from './stash-action.type.js';
import { STASH_ACTIONS } from './stash-actions.js';

/** True when `value` is one of git_stash's four actions. */
export function isStashAction(value: unknown): value is StashAction {
  return typeof value === 'string' && (STASH_ACTIONS as readonly string[]).includes(value);
}
