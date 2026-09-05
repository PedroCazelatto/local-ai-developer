// Which blockers are still open, derived by REPLAY exactly as the store derives it: a `raised` row
// whose id has no matching `resolved` row. Split out of blockers.ts.
//
// The replay is the point — nothing records "open" as a field, so the answer is always computed from
// the rows themselves and a reader can never be looking at a stale flag.

import type { BlockerRow, RaisedBlocker } from '../../core/session/index.js';

/** Every raised blocker with no matching `resolved` row, oldest first (the order they were raised in). */
export function openBlockers(rows: readonly BlockerRow[]): RaisedBlocker[] {
  const resolvedIds = new Set(rows.filter((row) => row.kind === 'resolved').map((row) => row.id));
  return rows.filter((row): row is { kind: 'raised' } & RaisedBlocker => row.kind === 'raised' && !resolvedIds.has(row.id));
}
