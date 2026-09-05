// The path-guard primitive: does an absolute path resolve to a root, or strictly under it?
//
// Both of Retro's fates turn on this and nothing else -- under rules/phases/ is SYSTEMIC and never
// auto-committed, under the project is TASK-SPECIFIC and committed. Resolving BOTH sides is what stops
// a `..` segment or a mixed separator from walking out of the root it is being checked against.
//
// Named isPathUnder rather than the module-private `isUnder` it was extracted from.

import path from 'node:path';

/** True when `abs` resolves to `root` itself or strictly under it. */
export function isPathUnder(abs: string, root: string): boolean {
  const r = path.resolve(root);
  const a = path.resolve(abs);
  return a === r || a.startsWith(r + path.sep);
}
