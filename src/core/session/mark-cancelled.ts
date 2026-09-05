// Hide a cancelled exchange's already-flushed turns, in one transaction, so the live history loses the
// whole exchange at once or not at all.
//
// Nothing is deleted — the rows stay exactly as a summary-collapsed turn does, readable with a plain
// `SELECT ... WHERE cancelled_at IS NOT NULL` — and `seq` is never reclaimed, so the abandoned branch
// keeps its numbering and the turns that follow simply continue past the gap. Turns still buffered in
// RAM are not this function's business: they carry `cancelledAt` into their own INSERT (see
// message-insert-params.ts).

import type { DatabaseSync } from 'node:sqlite';

import { inTransaction } from './in-transaction.js';

/** Stamp `cancelled_at` on every already-flushed turn of a cancelled exchange, in one transaction. */
export function markCancelled(
  db: DatabaseSync,
  contextId: string,
  seqs: readonly number[],
  cancelledAt: string,
): void {
  if (seqs.length === 0) return;
  // inTransaction: BEGIN / COMMIT, rolling back on any throw.
  inTransaction(db, () => {
    const mark = db.prepare(
      'UPDATE messages SET cancelled_at = ? WHERE context_id = ? AND seq = ? AND cancelled_at IS NULL',
    );
    for (const seq of seqs) {
      mark.run(cancelledAt, contextId, seq);
    }
  });
}
