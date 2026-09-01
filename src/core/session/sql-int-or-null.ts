// Read one SQLite column as an integer, PRESERVING NULL.
//
// A null stays null and is NEVER coerced to 0: the difference between "0 tokens" and "Ollama reported
// none" is the whole basis of the exact-token invariant (constitution). SQLite hands back `bigint` for
// values outside the safe-integer range, so both are accepted.

import type { SQLOutputValue } from 'node:sqlite';

/** Read one column as an integer, preserving NULL. */
export function sqlIntOrNull(value: SQLOutputValue | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}
