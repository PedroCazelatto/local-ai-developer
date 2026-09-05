// Run `work` inside one SQLite transaction, rolling back on any throw so a partial flush is never
// committed. Every multi-statement write in the memory store goes through it.

import type { DatabaseSync } from 'node:sqlite';

/** Run `work` inside one transaction, rolling back on any throw so a partial flush is never committed. */
export function inTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
