// Read the tail of the tool-call audit log — the `tool_audit` table of the project's memory.db — for the
// /audit listing.
//
// A pure read of rows the orchestrator already writes on every dispatched tool call (audit.ts) —
// nothing here writes, and nothing here is reachable by the model: a phase does not get to read the
// audit log at all (backlog/inspection-commands.md). It is the user's safety net for autonomous,
// no-confirmation tool calls, so it is a USER command's data source only.
//
// It never CREATES memory.db: a project with no database has recorded nothing, which is reported as
// that, rather than conjuring an empty database to read. Rows come back in the order they were WRITTEN
// (SQLite's implicit rowid — see memory-db.schema.ts), which is the order the old JSONL file held them
// in. A row that will not narrow is still counted and REPORTED rather than dropped silently, because a
// listing that silently drops rows is the one thing an audit view must never do.

import { existsSync } from 'node:fs';

import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import { memoryDbFile } from '../../core/session/memory-db-file.js'; // <projectPath>/.orchestrator/memory.db
import { openMemoryDb } from '../../core/session/open-memory-db.js';
import type { AuditRow } from './audit-row.type.js';
import { toAuditRow } from './to-audit-row.js'; // narrow one table row to the printable slice

/**
 * The tail of the audit log, or the reason it could not be read. `ok: false` is the recoverable path
 * — a project that has never dispatched a tool has no database, which is a normal state to report in
 * one line, not an error to throw out of a command.
 */
export type AuditTail =
  | {
      readonly ok: true;
      /** The last N rows, OLDEST FIRST (the order they were written in). */
      readonly rows: readonly AuditRow[];
      /** Every row in the table, so a listing can say which slice of the whole it is showing. */
      readonly total: number;
      /** Rows among the last N that would not narrow to a printable row — reported, never hidden. */
      readonly malformed: number;
    }
  | {
      readonly ok: false;
      /**
       * True when there is no memory.db at all — a project where nothing has run yet, which is a normal
       * state to state plainly. False when the database exists and could not be read, which is a fault
       * and is surfaced as one. The two must not print the same way.
       */
      readonly absent: boolean;
      readonly error: string;
    };

/** The last `limit` rows of the project's `tool_audit` table, oldest first, with the table's total. */
export function readAuditRows(projectPath: string, limit: number): AuditTail {
  if (!existsSync(memoryDbFile(projectPath))) {
    return { ok: false, absent: true, error: 'No tool calls recorded yet in this project.' };
  }
  try {
    const db = openMemoryDb(projectPath);
    try {
      const total = Number(db.prepare('SELECT COUNT(*) AS n FROM tool_audit').get()?.['n'] ?? 0);
      // The newest `limit` by write order, reversed below so the listing reads oldest first.
      const raw = db
        .prepare(
          'SELECT ts, phase, tool, exit_status, duration_ms, subagent_id FROM tool_audit ORDER BY rowid DESC LIMIT ?',
        )
        .all(limit)
        .reverse();
      const rows: AuditRow[] = [];
      let malformed = 0;
      for (const value of raw) {
        // toAuditRow: the columns share the old file's field names, so the one narrowing serves both.
        const row = toAuditRow(value);
        if (row === undefined) malformed += 1;
        else rows.push(row);
      }
      return { ok: true, rows, total, malformed };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, absent: false, error: `Could not read the tool audit log in .orchestrator/memory.db: ${errMessage(err)}` };
  }
}
