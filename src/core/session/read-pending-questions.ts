// What /questions re-asks: the questions still owed an answer, derived by replay.

import type { PendingQuestion } from './pending-question.type.js';
import { readQuestionRows } from './read-question-rows.js';

/** Every question still awaiting an answer — an `asked` row with no matching `answered` row. */
export function readPendingQuestions(projectPath: string): PendingQuestion[] {
  // readQuestionRows: every intact row in questions.jsonl, torn lines skipped.
  const rows = readQuestionRows(projectPath);
  const answeredIds = new Set(rows.filter((row) => row.kind === 'answered').map((row) => row.id));
  return rows.filter((row): row is { kind: 'asked' } & PendingQuestion => row.kind === 'asked' && !answeredIds.has(row.id));
}
