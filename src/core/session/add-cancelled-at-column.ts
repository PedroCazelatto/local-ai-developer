// Add `messages.cancelled_at` to a database created before turns could be cancelled.
//
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so presence is asked of `PRAGMA table_info` first — the
// check is a read of one small table at boot, and it makes the migration idempotent the way every
// other statement in the schema is.

import type { DatabaseSync } from 'node:sqlite';

import { ADD_CANCELLED_AT } from './memory-db.schema.js';
import { sqlText } from './sql-text.js';

/** Add `messages.cancelled_at` to a database created before turns could be cancelled. Idempotent. */
export function addCancelledAtColumn(db: DatabaseSync): void {
  const columns = db.prepare('SELECT name FROM pragma_table_info(?)').all('messages');
  // sqlText: the column as a string, or '' when absent/non-text.
  if (columns.some((column) => sqlText(column['name']) === 'cancelled_at')) return;
  db.exec(ADD_CANCELLED_AT);
}
