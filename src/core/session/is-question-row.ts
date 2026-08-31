// Defensive narrowing for one line of questions.jsonl — the file is hand-inspectable, so a row that
// does not match its own `kind` is dropped rather than trusted.

import type { QuestionRow } from './types.js';

/** Narrow a parsed JSON value to a QuestionRow (defensive — the file is hand-inspectable). */
export function isQuestionRow(value: unknown): value is QuestionRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'asked') {
    return (
      typeof row['id'] === 'string' &&
      typeof row['phase'] === 'string' &&
      typeof row['question'] === 'string' &&
      Array.isArray(row['options'])
    );
  }
  if (row['kind'] === 'answered') {
    return typeof row['id'] === 'string' && typeof row['answer'] === 'string';
  }
  if (row['kind'] === 'delivered') {
    return typeof row['id'] === 'string';
  }
  return false;
}
