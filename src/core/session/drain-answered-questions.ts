// Hand a phase the answers it is owed, exactly once. The `delivered` rows written here are what stop
// an answer being re-injected into the same window every turn — which would quietly burn context on a
// VRAM-bound box — and they survive a restart, so "exactly once" holds across one too.

import { appendJsonlLine } from './append-jsonl-line.js';
import { questionsFile } from './questions-file.js';
import { readQuestionRows } from './read-question-rows.js';
import type { AnsweredQuestion, PendingQuestion } from './types.js';

/**
 * Take the answers owed to `phase` and mark them delivered in the same breath: an `answered` row
 * with no `delivered` row, for a question that phase asked. The caller injects the returned answers
 * into that phase's context; the `delivered` rows written here are what guarantee it happens exactly
 * once, even across a restart.
 */
export function drainAnsweredQuestions(projectPath: string, phase: string): AnsweredQuestion[] {
  // readQuestionRows: every intact row in questions.jsonl, torn lines skipped.
  const rows = readQuestionRows(projectPath);
  const deliveredIds = new Set(rows.filter((row) => row.kind === 'delivered').map((row) => row.id));
  const asked = new Map(
    rows.filter((row): row is { kind: 'asked' } & PendingQuestion => row.kind === 'asked').map((row) => [row.id, row]),
  );
  const drained: AnsweredQuestion[] = [];
  for (const row of rows) {
    if (row.kind !== 'answered' || deliveredIds.has(row.id)) continue;
    const question = asked.get(row.id);
    if (question === undefined || question.phase !== phase) continue;
    drained.push({
      id: row.id,
      phase: question.phase,
      question: question.question,
      answer: row.answer,
      answeredAt: row.answeredAt,
    });
    // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
    appendJsonlLine(questionsFile(projectPath), { kind: 'delivered', id: row.id, deliveredAt: new Date().toISOString() });
  }
  return drained;
}
