// The last `limit` contexts of one phase, most recently active first — what `/resume` lists.
//
// The `num_ctx` filter is an INEQUALITY, and the asymmetry is the whole point: a context written under
// a ceiling AT OR BELOW `numCtx` replays safely, because a history that fitted 8 192 fits 16 384. One
// written under a LARGER ceiling is omitted — never deleted — because Ollama silently discards the
// oldest tokens past the ceiling, so replaying it here would leave the phase reasoning from turns it
// can no longer see. Raising OLLAMA_NUM_CTX back brings those contexts into view again.
//
// What is WRITTEN is untouched by this: `contexts.num_ctx` is still stamped with the EXACT value the
// turns really ran under (see flush-context.ts), so a row always states its own history, never the
// reader's.

import type { DatabaseSync } from 'node:sqlite';

import type { ContextSummary } from './context-summary.type.js';
import { LIST_SELECT } from './list-select-sql.js';
import { toContextSummary } from './to-context-summary.js';

/** The last `limit` contexts of one phase, most recently active first, excluding `excludeId`. */
export function listContexts(
  db: DatabaseSync,
  phase: string,
  numCtx: number,
  limit: number,
  excludeId: string | null,
): ContextSummary[] {
  const rows = db
    .prepare(
      `${LIST_SELECT} WHERE c.phase = ? AND c.num_ctx <= ? AND c.id IS NOT ? ` +
        'GROUP BY c.id ORDER BY last_at DESC LIMIT ?',
    )
    .all(phase, numCtx, excludeId, limit);
  // toContextSummary: one listing row into the ContextSummary shape.
  return rows.map(toContextSummary);
}
