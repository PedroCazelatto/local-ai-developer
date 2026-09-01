// Write the summary turn that collapses older turns, for the summarization failsafe.
//
// The originals are never deleted — only hidden from the visible view by pointing their `replaced_by`
// at the summary — so a collapse stays inspectable after the fact.

import type { DatabaseSync } from 'node:sqlite';

import { inTransaction } from './in-transaction.js';
import { INSERT_MESSAGE } from './insert-message-sql.js';
import type { MemoryRecord } from './memory-record.type.js';
import { messageInsertParams } from './message-insert-params.js';
import { sqlText } from './sql-text.js';

/**
 * Write the summary turn that collapses `replacedSeqs`, in one transaction: insert the `summary` row,
 * read back the UUID SQLite gave it, then point every collapsed turn's `replaced_by` at it. The
 * originals are never deleted — only hidden from the visible view — so a collapse stays inspectable
 * after the fact.
 */
export function collapseIntoSummary(
  db: DatabaseSync,
  contextId: string,
  summary: MemoryRecord,
  replacedSeqs: readonly number[],
): void {
  // inTransaction: BEGIN / COMMIT, rolling back on any throw.
  inTransaction(db, () => {
    const row = db.prepare(`${INSERT_MESSAGE} RETURNING id`).get(...messageInsertParams(contextId, summary));
    // sqlText: the column as a string, or '' when absent/non-text.
    const summaryId = sqlText(row?.['id']);
    if (summaryId === '') {
      throw new Error(`memory.db: inserting a summary into context '${contextId}' returned no id`);
    }
    const mark = db.prepare('UPDATE messages SET replaced_by = ? WHERE context_id = ? AND seq = ?');
    for (const seq of replacedSeqs) {
      mark.run(summaryId, contextId, seq);
    }
  });
}
