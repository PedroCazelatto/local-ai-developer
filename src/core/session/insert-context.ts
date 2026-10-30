// Create a context row and return the UUID SQLite generated for it.
//
// The id comes back via RETURNING rather than being computed here on purpose: the column DEFAULT is
// then the single source of ids, so a row inserted by hand at a sqlite3 prompt is identified the same
// way this one is.

import type { DatabaseSync } from 'node:sqlite';

import { sqlText } from './sql-text.js';

/** Create a context row and return the UUID SQLite generated for it. */
export function insertContext(db: DatabaseSync, phase: string, numCtx: number): string {
  const row = db.prepare('INSERT INTO contexts (phase, num_ctx) VALUES (?, ?) RETURNING id').get(phase, numCtx);
  // sqlText: the column as a string, or '' when absent/non-text.
  const id = sqlText(row?.['id']);
  if (id === '') {
    throw new Error(`memory.db: creating a context for phase '${phase}' returned no id`);
  }
  return id;
}
