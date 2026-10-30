// The ask_user panel's Review tab: every question with the answer that will be submitted for it.
//
// Two rows per question, always — an unanswered one says so rather than being left out, because the
// Review tab is what the user reads before pressing Enter and a missing row would read as a question
// that was never asked.

import { PANEL_INDENT } from './panel-indent.js';
import type { QuestionPanelState } from './render-question-panel.js';
import { singleLine } from './single-line.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';

/** Shown in the Review tab for a question the user moved past. */
const UNANSWERED = 'not answered — saved for /questions';

/** The Review tab: every question with the answer that will be submitted for it. */
export function panelReviewBody(state: QuestionPanelState, width: number): string[] {
  const lines: string[] = [];
  state.questions.forEach((question, index) => {
    lines.push(`${PANEL_INDENT}${theme.meta(`${index + 1}.`)} ${truncateToWidth(question.question, width - 5)}`);
    const answer = state.answers[index] ?? null; // an index past the end reads as unanswered, not as answered
    // singleLine first: a multi-line free-text answer must be flattened before it is measured, or the
    // newline survives truncation and breaks the panel's one-row-per-line guarantee.
    const shown = truncateToWidth(answer === null ? UNANSWERED : singleLine(answer), width - 7);
    lines.push(`${PANEL_INDENT}   ${answer === null ? theme.meta(shown) : theme.success(`→ ${shown}`)}`);
  });
  return lines;
}
