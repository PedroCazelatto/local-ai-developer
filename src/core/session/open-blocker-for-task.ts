// The open blocker for a task, derived by REPLAY rather than read from a mutable flag.

import type { RaisedBlocker } from './raised-blocker.type.js';
import { readBlockerRows } from './read-blocker-rows.js';

/**
 * The OPEN blocker for a task, or undefined — a `raised` row whose id has no matching `resolved` row.
 * A task holds at most one open blocker at a time (it can't be re-blocked until it is re-run, and it
 * is only re-run after being answered), so returning the latest-raised open one is unambiguous.
 */
export function openBlockerForTask(projectPath: string, taskId: string): RaisedBlocker | undefined {
  // readBlockerRows: every intact row in blockers.jsonl, torn lines skipped.
  const rows = readBlockerRows(projectPath);
  const resolvedIds = new Set(rows.filter((row) => row.kind === 'resolved').map((row) => row.id));
  const open = rows.filter(
    (row): row is { kind: 'raised' } & RaisedBlocker =>
      row.kind === 'raised' && row.taskId === taskId && !resolvedIds.has(row.id),
  );
  return open.length === 0 ? undefined : open[open.length - 1];
}
