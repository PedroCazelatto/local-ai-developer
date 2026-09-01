// Narrow one parsed JSONL value to the AuditRow slice the /audit listing prints. Split out of
// read-audit-rows.ts.

import type { AuditRow } from './audit-row.type.js';
import { finiteNumberOrNull } from './finite-number-or-null.js'; // a finite number, else null (never 0)
import { nonEmptyText } from './non-empty-text.js'; // a non-empty string, else undefined

/**
 * Narrow one parsed JSON value to the AuditRow slice, or undefined when it is not a usable row. Only
 * `ts`, `phase` and `tool` are required: they are what identifies a call, and a row missing any of
 * them names nothing. A missing exit status or duration is kept as null and reported as unknown.
 */
export function toAuditRow(value: unknown): AuditRow | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  const ts = nonEmptyText(row['ts']);
  const phase = nonEmptyText(row['phase']);
  const tool = nonEmptyText(row['tool']);
  if (ts === undefined || phase === undefined || tool === undefined) return undefined;
  const subagentId = nonEmptyText(row['subagent_id']);
  return {
    ts,
    phase,
    tool,
    exitStatus: finiteNumberOrNull(row['exit_status']),
    durationMs: finiteNumberOrNull(row['duration_ms']),
    // A master-phase call omits the field entirely (audit.ts) — keep it absent rather than null.
    ...(subagentId !== undefined ? { subagentId } : {}),
  };
}
