// Record the user's answer to a pending question (from /questions). Append-only: the `asked` row is
// never edited, and the pair of rows IS the state.

import { appendJsonlLine } from './append-jsonl-line.js';
import { questionsFile } from './questions-file.js';

/** Record the user's answer to a pending question (from /questions). */
export function answerQuestion(projectPath: string, id: string, answer: string): void {
  // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
  appendJsonlLine(questionsFile(projectPath), { kind: 'answered', id, answer, answeredAt: new Date().toISOString() });
}
