// Narrow one row of memory.db's `events` table to the EventRow /events prints — the events twin of
// to-audit-row.ts.

import type { EventRow } from './event-row.type.js';
import { finiteNumberOrNull } from './finite-number-or-null.js'; // a finite number, else null (never 0)
import { nonEmptyText } from './non-empty-text.js'; // a non-empty string, else undefined

/**
 * The printable row, or undefined when the value is not a usable one: `ts` and `type` must be present,
 * `phase` must be a string (possibly empty — some events fire outside any phase), and `detail` must be a
 * JSON object of string, number and boolean fields, which is the only shape appendEvent writes.
 */
export function toEventRow(value: unknown): EventRow | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  const ts = nonEmptyText(row['ts']);
  const type = nonEmptyText(row['type']);
  const phase = row['phase'];
  if (ts === undefined || type === undefined || typeof phase !== 'string') return undefined;
  const rawDetail = row['detail'];
  if (typeof rawDetail !== 'string') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawDetail);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const detail: Record<string, string | number | boolean> = {};
  for (const [key, field] of Object.entries(parsed)) {
    if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') detail[key] = field;
    else return undefined;
  }
  const subagentId = nonEmptyText(row['subagent_id']);
  return {
    ts,
    type,
    phase,
    detail,
    promptTokens: finiteNumberOrNull(row['prompt_tokens']),
    evalTokens: finiteNumberOrNull(row['eval_tokens']),
    // An event outside any sub-agent leaves the column NULL — keep the field absent rather than null.
    ...(subagentId !== undefined ? { subagentId } : {}),
  };
}
