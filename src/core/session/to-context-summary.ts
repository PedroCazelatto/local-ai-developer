// Rebuild one listing row into a ContextSummary. Named toContextSummary rather than the module-private
// `toSummary` it was extracted from, which says nothing standing alone beside to-memory-record.ts.

import type { SQLOutputValue } from 'node:sqlite';

import type { ContextSummary } from './context-summary.type.js';
import { sqlInt } from './sql-int.js';
import { sqlText } from './sql-text.js';
import { sqlTextOrNull } from './sql-text-or-null.js';

/** Rebuild one listing row into a ContextSummary. */
export function toContextSummary(row: Record<string, SQLOutputValue>): ContextSummary {
  const models = sqlTextOrNull(row['models']);
  return {
    id: sqlText(row['id']),
    phase: sqlText(row['phase']),
    title: sqlTextOrNull(row['title']),
    createdAt: sqlText(row['created_at']),
    lastActivityAt: sqlText(row['last_at']),
    numCtx: sqlInt(row['num_ctx']),
    turnCount: sqlInt(row['turns']),
    totalTokens: sqlInt(row['tokens']),
    models: models === null || models === '' ? [] : models.split(','),
  };
}
