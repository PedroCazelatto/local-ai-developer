// The permanent record of one ask_user exchange, printed once the live panel has erased itself.
//
// This is the transient-widget pattern's second half (constitution, Terminal UX): the frame repaints
// while it is under the cursor, then collapses into exactly one static, copyable summary in the
// append-only scrollback. Two rows per question, always — an unanswered one says where its answer went
// (`/questions`) rather than vanishing.

import { stdout } from 'node:process';

import type { AskQuestion } from './ask-questions.js';
import { singleLine } from './single-line.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';

/**
 * Print the permanent record of the exchange: the live panel is gone, so this is what the user (and
 * their scrollback) keeps. Append-only and copyable, like every other line in the conversation.
 */
export function writeQuestionTranscript(
  phase: string,
  questions: readonly AskQuestion[],
  answers: readonly (string | null)[],
): void {
  const width = terminalColumns();
  const answered = answers.filter((answer) => answer !== null).length;
  stdout.write(`${theme.phase(phase)(`${phase} asked`)} ${theme.meta(`· ${answered} of ${questions.length} answered`)}\n`);
  questions.forEach((question, index) => {
    const answer = answers[index];
    stdout.write(`  ${theme.meta(`${index + 1}.`)} ${truncateToWidth(question.question, width - 5)}\n`);
    if (answer === undefined || answer === null) {
      stdout.write(`     ${theme.meta(truncateToWidth('saved — answer it later with /questions', width - 6))}\n`);
    } else {
      // singleLine: this is a one-row summary, so a multi-line answer is flattened before measuring —
      // a surviving newline would both mis-measure the truncation and break the two-rows-per-question shape.
      stdout.write(`     ${theme.success(`→ ${truncateToWidth(singleLine(answer), width - 8)}`)}\n`);
    }
  });
}
