// Read one SQLite column as an integer, treating NULL as 0 — for COUNT/SUM aggregates ONLY.
//
// Never use this for a token count: sql-int-or-null.ts exists precisely because a null token metric
// must not become a zero (constitution: token counts are always exact).

import type { SQLOutputValue } from 'node:sqlite';

import { sqlIntOrNull } from './sql-int-or-null.js';

/** Read one column as an integer, treating NULL as 0 — for COUNT/SUM aggregates only, never for tokens. */
export function sqlInt(value: SQLOutputValue | undefined): number {
  // sqlIntOrNull: number | bigint -> number, and null stays null.
  return sqlIntOrNull(value) ?? 0;
}
