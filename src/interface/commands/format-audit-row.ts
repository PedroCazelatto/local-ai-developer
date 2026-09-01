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

import type { AuditRow } from './audit-row.type.js';
import { auditClock } from './audit-clock.js'; // the row's UTC stamp as a local HH:mm:ss
import { durationLabel } from './duration-label.js'; // `840ms` / `4.2s` / `2m 49s`, or `unknown`
import { exitLabel } from './exit-label.js'; // `exit 0` / `exit -1` / `exit ?`

/** Column widths the formatter pads to, so a block of rows lines up as a table. */
export interface AuditColumnWidths {
  /** Widest phase name in the rows being printed. */
  readonly phase: number;
  /** Widest tool name in the rows being printed. */
  readonly tool: number;
}

/**
 * One row as `<HH:mm:ss> · <phase> · <tool> · <exit> · <duration>`, padded to `widths`. A sub-agent's
 * own call carries its id as a trailing field so the lineage of a call made outside a master phase is
 * visible in the listing rather than only in the raw JSON.
 */
export function formatAuditRow(row: AuditRow, widths: AuditColumnWidths): string {
  const fields = [
    auditClock(row.ts),
    row.phase.padEnd(widths.phase),
    row.tool.padEnd(widths.tool),
    exitLabel(row.exitStatus).padEnd(7),
    durationLabel(row.durationMs),
  ];
  if (row.subagentId !== undefined) fields.push(`sub:${row.subagentId}`);
  return fields.join(' · ');
}
