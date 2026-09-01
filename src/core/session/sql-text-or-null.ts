// Read one SQLite column as text OR null — for the genuinely nullable columns, where the difference
// between "empty" and "absent" carries meaning (`title`, `model`, `tool_name`).

import type { SQLOutputValue } from 'node:sqlite';

/** Read one column as text or null — for the genuinely nullable columns (`title`, `model`, `tool_name`). */
export function sqlTextOrNull(value: SQLOutputValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}
