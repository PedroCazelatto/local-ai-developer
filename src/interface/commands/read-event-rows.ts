// Read the tail of the harness events log — the `events` table of the project's memory.db — for the
// /events listing. Until backlog item 19 these rows went to `events.jsonl` and nothing read them, so an
// unexplained pause (a compaction, an eviction, a cancelled turn) had no in-app explanation.
//
// The events twin of read-audit-rows.ts, with the same three rules: it never CREATES memory.db, rows
// come back in the order they were written (the implicit rowid), and a row that will not narrow is
// counted and reported rather than dropped silently.

import { existsSync } from 'node:fs';

import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import { memoryDbFile } from '../../core/session/memory-db-file.js'; // <projectPath>/.orchestrator/memory.db
import { openMemoryDb } from '../../core/session/open-memory-db.js';
import type { EventRow } from './event-row.type.js';
import { toEventRow } from './to-event-row.js'; // narrow one table row to the printable slice

/** The tail of the events log, or the reason it could not be read — the shape AuditTail has. */
export type EventTail =
  | {
      readonly ok: true;
      /** The last N rows, OLDEST FIRST (the order they were written in). */
      readonly rows: readonly EventRow[];
      /** Every row in the table, so a listing can say which slice of the whole it is showing. */
      readonly total: number;
      /** Rows among the last N that would not narrow to a printable row — reported, never hidden. */
      readonly malformed: number;
    }
  | {
      readonly ok: false;
      /** True when there is no memory.db at all — a plain fact, not a fault (see AuditTail). */
      readonly absent: boolean;
      readonly error: string;
    };

/** The last `limit` rows of the project's `events` table, oldest first, with the table's total. */
export function readEventRows(projectPath: string, limit: number): EventTail {
  if (!existsSync(memoryDbFile(projectPath))) {
    return { ok: false, absent: true, error: 'No harness events recorded yet in this project.' };
  }
  try {
    const db = openMemoryDb(projectPath);
    try {
      const total = Number(db.prepare('SELECT COUNT(*) AS n FROM events').get()?.['n'] ?? 0);
      // The newest `limit` by write order, reversed below so the listing reads oldest first.
      const raw = db
        .prepare(
          'SELECT ts, type, phase, subagent_id, detail, prompt_tokens, eval_tokens FROM events ORDER BY rowid DESC LIMIT ?',
        )
        .all(limit)
        .reverse();
      const rows: EventRow[] = [];
      let malformed = 0;
      for (const value of raw) {
        // toEventRow: the printable slice, `detail` parsed back from its JSON text.
        const row = toEventRow(value);
        if (row === undefined) malformed += 1;
        else rows.push(row);
      }
      return { ok: true, rows, total, malformed };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, absent: false, error: `Could not read the events log in .orchestrator/memory.db: ${errMessage(err)}` };
  }
}
