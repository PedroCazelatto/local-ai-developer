// Defensive narrowing for one line of blockers.jsonl. The file is both hand-inspectable and
// machine-fed, so a row that does not match its `kind` is dropped rather than trusted.

import type { BlockerRow } from './blocker-row.type.js';

/** Narrow a parsed JSON value to a BlockerRow (defensive — the file is hand-inspectable + machine-fed). */
export function isBlockerRow(value: unknown): value is BlockerRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'raised') {
    return typeof row['id'] === 'string' && typeof row['taskId'] === 'string' && typeof row['question'] === 'string';
  }
  if (row['kind'] === 'resolved') {
    return typeof row['id'] === 'string' && typeof row['answer'] === 'string';
  }
  return false;
}
