// What a reopen replays into the phase's prompt.
//
// The VISIBLE predicate excludes both turns a summary collapsed and turns a cancelled exchange
// branched off, so the walk that used to run in JS is now the query. A cancelled exchange must be
// filtered here too: reopening a context should restore the history the phase actually had, not the
// one the user stopped and rewrote.

import type { DatabaseSync } from 'node:sqlite';

import type { MemoryRecord } from './memory-record.type.js';
import { toMemoryRecord } from './to-memory-record.js';
import { visibleTurnWhere } from './visible-turn-where.js';

/** A context's CURRENTLY-VISIBLE turns in order. */
export function readVisibleMessages(db: DatabaseSync, contextId: string): MemoryRecord[] {
  const rows = db
    .prepare(
      'SELECT seq, role, content, model, tool_name, tool_calls, prompt_tokens, completion_tokens, created_at ' +
        // visibleTurnWhere: not collapsed by a summary AND not cancelled.
        `FROM messages WHERE context_id = ? AND ${visibleTurnWhere()} ORDER BY seq`,
    )
    .all(contextId);
  // toMemoryRecord: one row back into the in-RAM turn shape.
  return rows.map(toMemoryRecord);
}
