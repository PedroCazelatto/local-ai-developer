// Resolve a user- or model-supplied address to exactly ONE context, or to nothing.
//
// Restricted to the phase's own contexts and to `num_ctx <= ?` — the SAME predicate listContexts uses,
// so an address can never reach a context the listing refuses to show, and never fails to reach one it
// does show.

import type { DatabaseSync } from 'node:sqlite';

import { sqlText } from './sql-text.js';

/**
 * Resolve a user- or model-supplied address to exactly one context of `phase`: a full UUID or any
 * unique leading prefix of one (`design/7a888b1f`). Ambiguous or unknown input resolves to null, so a
 * caller never acts on a guess.
 */
export function resolveContextId(db: DatabaseSync, phase: string, numCtx: number, address: string): string | null {
  const wanted = address.trim().toLowerCase();
  if (wanted === '') return null;
  const rows = db
    .prepare("SELECT id FROM contexts WHERE phase = ? AND num_ctx <= ? AND id LIKE ? || '%'")
    .all(phase, numCtx, wanted);
  // sqlText: the column as a string, or '' when absent/non-text.
  return rows.length === 1 ? sqlText(rows[0]?.['id']) : null;
}
