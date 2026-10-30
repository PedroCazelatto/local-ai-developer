// Read the tail of the tool-call audit log (.orchestrator/tool_audit.jsonl) for the /audit listing.
//
// A pure read of a file the orchestrator already writes on every dispatched tool call (audit.ts) —
// nothing here writes, and nothing here is reachable by the model: a phase does not get to read the
// audit log at all (backlog/inspection-commands.md). It is the user's safety net for autonomous,
// no-confirmation tool calls, so it is a USER command's data source only.
//
// Same replay discipline as the stores that write these files (blocker-store.ts / inbox-store.ts): a
// line that will not parse is skipped rather than allowed to sink the read — a kill mid-write leaves
// a partial LAST line at worst. Unlike those stores the skipped count is REPORTED, because a listing
// that silently drops rows is the one thing an audit view must never do.

import { existsSync, readFileSync } from 'node:fs';

import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import type { AuditRow } from './audit-row.type.js';
import { auditLogFile } from './audit-log-file.js'; // <projectPath>/.orchestrator/tool_audit.jsonl
import { toAuditRow } from './to-audit-row.js'; // narrow one parsed line to the printable slice

/**
 * The tail of the audit log, or the reason it could not be read. `ok: false` is the recoverable path
 * — a project that has never dispatched a tool has no file, which is a normal state to report in one
 * line, not an error to throw out of a command.
 */
export type AuditTail =
  | {
      readonly ok: true;
      /** The last N intact rows, OLDEST FIRST (the order the file holds them in). */
      readonly rows: readonly AuditRow[];
      /** Every intact row in the file, so a listing can say which slice of the whole it is showing. */
      readonly total: number;
      /** Lines that were not readable as a row (a torn last line at worst) — reported, never hidden. */
      readonly malformed: number;
    }
  | {
      readonly ok: false;
      /**
       * True when the log simply is not there — a project where no tool has run yet, which is a normal
       * state to state plainly. False when the file exists and could not be read, which is a fault and
       * is surfaced as one. The two must not print the same way.
       */
      readonly absent: boolean;
      readonly error: string;
    };

/**
 * The last `limit` intact rows of the project's audit log, oldest first, with the intact total and the
 * count of lines that would not parse. A missing file (no tool has run in this project yet) and an
 * unreadable one both come back as a recoverable `ok: false` reason for the caller to print in one
 * line — the way /run degrades on a BacklogError.
 */
export function readAuditRows(projectPath: string, limit: number): AuditTail {
  const file = auditLogFile(projectPath);
  if (!existsSync(file)) {
    return { ok: false, absent: true, error: 'No tool calls recorded yet in this project.' };
  }
  let text: string;
  try {
    text = readFileSync(file, 'utf-8');
  } catch (err) {
    return { ok: false, absent: false, error: `Could not read .orchestrator/tool_audit.jsonl: ${errMessage(err)}` };
  }

  const rows: AuditRow[] = [];
  let malformed = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const row = toAuditRow(parsed);
      if (row === undefined) malformed += 1;
      else rows.push(row);
    } catch {
      malformed += 1; // a partial/torn line (a kill mid-tool) — count it, keep replaying the intact rows
    }
  }

  // The tail, oldest first: slice from the end so the newest call is always included, then keep the
  // file's own order within the slice (the caller decides which end it prints first).
  return { ok: true, rows: limit >= rows.length ? rows : rows.slice(rows.length - limit), total: rows.length, malformed };
}
