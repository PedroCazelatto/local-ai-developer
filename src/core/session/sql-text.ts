// Read one SQLite column as text. Defensive: the schema forbids a non-text value here, but a
// hand-edited database must not throw on read.

import type { SQLOutputValue } from 'node:sqlite';

/** Read one column as text, or '' when the value is absent/non-text (defensive; the schema forbids it). */
export function sqlText(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}
