// Persist the questions the user did NOT answer. A question answered on the spot is already in the
// ask_user tool result and needs no life beyond the turn; a question skipped is a debt the model is
// owed, and must outlive the turn, the phase swap, and a restart.

import { appendJsonlLine } from './append-jsonl-line.js';
import type { PendingQuestion } from './pending-question.type.js';
import { questionsFile } from './questions-file.js';
import { readQuestionRows } from './read-question-rows.js';

/**
 * Persist the questions the user left unanswered, minting each id as `${phase}#${n}` from the count
 * of questions this phase has ever saved. Ids are assigned HERE, at write time, and never at ask
 * time: only a fraction of a batch is normally saved, so an id derived before the widget ran would
 * be handed out again on the next call and collide. No parallelism (CLAUDE.md), so count-then-append
 * is race-free. Returns the saved questions, ids included.
 */
export function saveUnansweredQuestions(
  projectPath: string,
  phase: string,
  questions: readonly { readonly question: string; readonly options: readonly string[] }[],
): PendingQuestion[] {
  // readQuestionRows: every intact row in questions.jsonl, torn lines skipped.
  const priorForPhase = readQuestionRows(projectPath).filter((row) => row.kind === 'asked' && row.phase === phase).length;
  const saved: PendingQuestion[] = [];
  questions.forEach((question, index) => {
    const pending: PendingQuestion = {
      id: `${phase}#${priorForPhase + index + 1}`,
      phase,
      question: question.question,
      options: [...question.options],
      askedAt: new Date().toISOString(),
    };
    // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
    appendJsonlLine(questionsFile(projectPath), { kind: 'asked', ...pending });
    saved.push(pending);
  });
  return saved;
}
