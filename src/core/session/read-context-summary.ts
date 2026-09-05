// One context's listing row by id — what `/resume <address>` reports back, since it has no listing to
// take the row from.

import type { DatabaseSync } from 'node:sqlite';

import type { ContextSummary } from './context-summary.type.js';
import { LIST_SELECT } from './list-select-sql.js';
import { toContextSummary } from './to-context-summary.js';

/** One context by id, or null when no row carries it (a hand-deleted row, or an id that never existed). */
export function readContextSummary(db: DatabaseSync, contextId: string): ContextSummary | null {
  const row = db.prepare(`${LIST_SELECT} WHERE c.id = ? GROUP BY c.id`).get(contextId);
  // toContextSummary: one listing row into the ContextSummary shape.
  return row === undefined ? null : toContextSummary(row);
}
