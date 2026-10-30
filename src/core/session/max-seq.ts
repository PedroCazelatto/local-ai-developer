// The highest `seq` a context has used, INCLUDING turns a summary has collapsed.
//
// A reopen needs this rather than the visible count: reusing a collapsed turn's seq would collide with
// `UNIQUE (context_id, seq)` and abort the very next flush.

import type { DatabaseSync } from 'node:sqlite';

import { sqlInt } from './sql-int.js';

/** The highest `seq` used in a context, including collapsed turns — 0 for an empty context. */
export function maxSeq(db: DatabaseSync, contextId: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS top FROM messages WHERE context_id = ?').get(contextId);
  // sqlInt: an aggregate, so NULL means 0 here — never used for a token count.
  return sqlInt(row?.['top']);
}
