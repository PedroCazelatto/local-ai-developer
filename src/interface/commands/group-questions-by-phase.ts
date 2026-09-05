// Group saved questions by the phase that asked them, so /questions puts a mixed backlog back as
// coherent rounds rather than one scrambled list — a Discovery question and a Design question want
// different heads. Split out of questions.ts.
//
// Named for the key it groups ON as well as the thing it groups, unlike groupTasks beside it: the
// private name was `byPhase`, which as a file name would have said what the key is and never what is
// in the map.

import type { PendingQuestion } from '../../core/session/index.js';

/** The pending questions bucketed by asking phase, each bucket in the order the store replayed them. */
export function groupQuestionsByPhase(questions: readonly PendingQuestion[]): Map<string, PendingQuestion[]> {
  const grouped = new Map<string, PendingQuestion[]>();
  for (const question of questions) {
    const existing = grouped.get(question.phase);
    if (existing === undefined) grouped.set(question.phase, [question]);
    else existing.push(question);
  }
  return grouped;
}
