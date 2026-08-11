// One audit row as ONE line: `HH:mm:ss · phase · tool · exit · duration`.
//
// Pure — text in, text out, nothing printed and no color chosen here: the caller cuts the line to the
// terminal's width and paints it through theme.ts (write-fitted-line.ts). That keeps the line's look
// reviewable in isolation, the way render-question-panel.ts is.
//
// A phase name and a tool name are padded to the widest in the block being printed, so a run of rows
// reads as a table with the columns lined up — the same trick /help uses for its command column. The
// clock leads because the audit log's question is "what happened, and when": a listing with no time
// on it cannot be lined up against anything else the user saw.

import type { AuditColumnWidths, AuditRow } from './read-audit-rows.type.js';

/**
 * The row's UTC timestamp as a LOCAL `HH:mm:ss`. Time only, not the date: /audit shows a recent tail,
 * so the date is the same on nearly every row and would cost width the tool name needs. A value that
 * will not parse holds its column with `--:--:--` rather than collapsing the table.
 */
function clock(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '--:--:--';
  const when = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}`;
}

/** Under a second: whole milliseconds. Under a minute: seconds to one decimal. Beyond: `2m 49s`. */
function duration(ms: number | null): string {
  // An unreported duration is stated as unknown rather than shown as 0ms, which would read as a call
  // that took no time (constitution: surface a missing metric, never substitute a plausible number).
  if (ms === null) return 'unknown';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}

/** `exit 0` / `exit -1` (dispatch's "any failure") / `exit ?` when the row carried no status. */
function exit(status: number | null): string {
  return status === null ? 'exit ?' : `exit ${status}`;
}

/**
 * One row as `<HH:mm:ss> · <phase> · <tool> · <exit> · <duration>`, padded to `widths`. A sub-agent's
 * own call carries its id as a trailing field so the lineage of a call made outside a master phase is
 * visible in the listing rather than only in the raw JSON.
 */
export function formatAuditRow(row: AuditRow, widths: AuditColumnWidths): string {
  const fields = [
    clock(row.ts),
    row.phase.padEnd(widths.phase),
    row.tool.padEnd(widths.tool),
    exit(row.exitStatus).padEnd(7),
    duration(row.durationMs),
  ];
  if (row.subagentId !== undefined) fields.push(`sub:${row.subagentId}`);
  return fields.join(' · ');
}
