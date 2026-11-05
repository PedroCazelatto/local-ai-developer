// Format one /events row: the harness's own actions in the shape /audit gives the model's tool calls.

import { auditClock } from './audit-clock.js'; // the row's UTC stamp as a local HH:mm:ss
import type { EventRow } from './event-row.type.js';

/** Column widths the formatter pads to, so a block of rows lines up as a table. */
export interface EventColumnWidths {
  /** Widest phase name in the rows being printed. */
  readonly phase: number;
  /** Widest event type in the rows being printed. */
  readonly type: number;
}

/**
 * One row as `<HH:mm:ss> · <phase> · <type> · <key=value …> · <tokens>`, padded to `widths`. The detail
 * is printed as it was written, field by field, because its fields ARE the explanation — `before` and
 * `after` on a compaction, `reason` on a cancelled turn. Token figures appear only when the event carried
 * them, and a sub-agent's event carries its id as a trailing field, as /audit does.
 */
export function formatEventRow(row: EventRow, widths: EventColumnWidths): string {
  const fields = [auditClock(row.ts), (row.phase === '' ? '-' : row.phase).padEnd(widths.phase), row.type.padEnd(widths.type)];
  const detail = Object.entries(row.detail).map(([key, value]) => `${key}=${String(value)}`);
  if (detail.length > 0) fields.push(detail.join(' '));
  const tokens: string[] = [];
  if (row.promptTokens !== null) tokens.push(`prompt ${row.promptTokens.toLocaleString('en-US')}`);
  if (row.evalTokens !== null) tokens.push(`eval ${row.evalTokens.toLocaleString('en-US')}`);
  if (tokens.length > 0) fields.push(tokens.join(' '));
  if (row.subagentId !== undefined) fields.push(`sub:${row.subagentId}`);
  return fields.join(' · ');
}
