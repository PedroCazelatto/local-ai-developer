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
import path from 'node:path';

import type { AuditRow, AuditTail } from './read-audit-rows.type.js';

/** Absolute path to a project's tool-call audit log (durable session state under .orchestrator/). */
function auditLogFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'tool_audit.jsonl');
}

/** A row field that must be a non-empty string, or undefined when it is anything else. */
function readText(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw !== '' ? raw : undefined;
}

/** A row field that must be a finite number, else null — surfaced as unknown, never defaulted to 0. */
function readNumber(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/**
 * Narrow one parsed JSON value to the AuditRow slice, or undefined when it is not a usable row. Only
 * `ts`, `phase` and `tool` are required: they are what identifies a call, and a row missing any of
 * them names nothing. A missing exit status or duration is kept as null and reported as unknown.
 */
function toAuditRow(value: unknown): AuditRow | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  const ts = readText(row['ts']);
  const phase = readText(row['phase']);
  const tool = readText(row['tool']);
  if (ts === undefined || phase === undefined || tool === undefined) return undefined;
  const subagentId = readText(row['subagent_id']);
  return {
    ts,
    phase,
    tool,
    exitStatus: readNumber(row['exit_status']),
    durationMs: readNumber(row['duration_ms']),
    // A master-phase call omits the field entirely (audit.ts) — keep it absent rather than null.
    ...(subagentId !== undefined ? { subagentId } : {}),
  };
}

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
    const why = err instanceof Error ? err.message : String(err);
    return { ok: false, absent: false, error: `Could not read .orchestrator/tool_audit.jsonl: ${why}` };
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
