// The ask_user widget: a tabbed question panel driven by arrow keys, one tab per question plus a
// final Review tab that submits. Backs both the ask_user tool and `/questions` (the same panel
// re-asks what was left unanswered), so it knows nothing about tools, stores, or phases beyond a
// name to show.
//
// Keymap (the user's spec): ↑↓ move within the options, Enter confirms the highlighted option and
// advances a tab, ←→ move between tabs freely, Enter on the Review tab submits. Option numbers are
// LABELS, not keys — arrows only. Esc / Ctrl-C close the widget where it stands, keeping the answers
// already given; everything still unanswered comes back as null for the caller to persist. Nothing
// the user typed is ever discarded by leaving.
//
// Why it redraws (when the rest of the REPL is strictly append-only): this is a transient widget,
// not history — like the ora spinner. It repaints only its own block, which is still under the
// cursor and has not scrolled away, then erases itself and prints ONE static summary of the
// questions and answers into the scrollback. What survives in the buffer is append-only and
// copyable; only the live frame is ever rewritten.
//
// stdin handling mirrors confirm-key.ts: readline owns stdin inside the REPL and buffers every
// printable keypress into its own line — even mid-question — so a naive read would leak the user's
// arrow keys and typed text into the next `› ` prompt. We snapshot and detach every current
// keypress listener, run our own, then restore exactly what we found.

import { stdin, stdout } from 'node:process';
import { emitKeypressEvents } from 'node:readline';
import type { Key } from 'node:readline';

import type { AskOutcome, AskQuestion, QuestionPanelMode } from './ask-questions.type.js';
import { renderQuestionPanel } from './render-question-panel.js';
import { terminalColumns } from './terminal-columns.js';
import { truncateToWidth } from './truncate-to-width.js';
import { theme } from './theme.js';

/** The free-text choice appended below every question's model-supplied options. */
const OTHER_LABEL = 'Other (type your own)';

/** A `keypress` listener as `emitKeypressEvents` emits them: the decoded string plus the parsed key. */
type KeypressListener = (str: string | undefined, key: Key | undefined) => void;

/**
 * Put `questions` to the user and block until they submit or close the widget. Answers are returned
 * index-aligned with the input; a null means "left unanswered" — a normal outcome the caller
 * persists, not an error.
 *
 * Off a TTY there are no keys to read, so every question comes back unanswered rather than hanging
 * a batch forever on input that can never arrive.
 */
export async function askQuestions(phase: string, questions: readonly AskQuestion[]): Promise<AskOutcome> {
  const answers: (string | null)[] = questions.map(() => null);
  if (!stdin.isTTY || questions.length === 0) return { answers };

  // The model's options plus our free-text escape — the user can never be cornered by options the
  // model failed to imagine, no matter what it sent.
  const options: readonly string[][] = questions.map((question) => [...question.options, OTHER_LABEL]);
  const reviewTab = questions.length;

  let tab = 0;
  let cursor = 0;
  let mode: QuestionPanelMode = 'select';
  let draft = '';
  /** Rows the last frame occupied, so the next draw knows how far up to go. */
  let drawnRows = 0;

  const frame = (): string[] =>
    renderQuestionPanel({ phase, questions, options, answers, tab, cursor, mode, draft });

  /** Repaint the panel in place: rewind over the last frame, write the new one, blank any leftovers. */
  const draw = (): void => {
    const lines = frame();
    if (drawnRows > 0) stdout.write(`\x1b[${drawnRows}A\r`);
    for (const line of lines) stdout.write(`\x1b[2K${line}\n`);
    // A shorter frame than last time (fewer options) would leave the old tail on screen — blank it,
    // then climb back to sit directly below the panel so the next rewind is measured from there.
    const leftover = Math.max(0, drawnRows - lines.length);
    for (let row = 0; row < leftover; row += 1) stdout.write('\x1b[2K\n');
    if (leftover > 0) stdout.write(`\x1b[${leftover}A`);
    drawnRows = lines.length;
  };

  /** Wipe the live panel so a static summary can take its place in the scrollback. */
  const erase = (): void => {
    if (drawnRows === 0) return;
    stdout.write(`\x1b[${drawnRows}A\r`);
    for (let row = 0; row < drawnRows; row += 1) stdout.write('\x1b[2K\n');
    stdout.write(`\x1b[${drawnRows}A`);
    drawnRows = 0;
  };

  /** Land on the answer already chosen for a tab (free text points at "Other"), else the first option. */
  const cursorFor = (index: number): number => {
    const answer = answers[index];
    const list = options[index];
    if (answer === null || answer === undefined || list === undefined) return 0;
    const found = list.indexOf(answer);
    return found === -1 ? list.length - 1 : found;
  };

  const goToTab = (next: number): void => {
    tab = Math.max(0, Math.min(reviewTab, next));
    mode = 'select';
    draft = '';
    cursor = tab < reviewTab ? cursorFor(tab) : 0;
    draw();
  };

  emitKeypressEvents(stdin); // no-op inside the REPL (readline already installed the decoder)
  const priorRaw = stdin.isRaw;
  stdin.setRawMode(true);
  // Suspend readline's own handler (and the REPL's status repaint) so our keys never reach its line.
  const suspended = stdin.listeners('keypress') as KeypressListener[];
  for (const listener of suspended) stdin.off('keypress', listener);

  try {
    draw();
    await new Promise<void>((resolve) => {
      const finish = (): void => {
        stdin.off('keypress', onKey);
        resolve();
      };
      /** Commit the highlighted option (or open the editor for "Other") and move on. */
      const confirmOption = (): void => {
        const list = options[tab];
        const chosen = list?.[cursor];
        if (list === undefined || chosen === undefined) return;
        // The free-text escape is identified by POSITION (always appended last), never by its label —
        // a model option that happened to read "Other (type your own)" must not hijack the editor.
        if (cursor === list.length - 1) {
          mode = 'text';
          draft = '';
          draw();
          return;
        }
        answers[tab] = chosen;
        goToTab(tab + 1);
      };
      const onKey: KeypressListener = (str, key) => {
        if (key === undefined) return;
        if (key.ctrl === true && key.name === 'c') return finish();

        if (mode === 'text') {
          if (key.name === 'escape') {
            mode = 'select';
            draft = '';
            return draw();
          }
          if (key.name === 'return' || key.name === 'enter') {
            if (draft.trim() === '') return; // an empty free-text answer is no answer — keep typing
            answers[tab] = draft.trim();
            return goToTab(tab + 1);
          }
          if (key.name === 'backspace') {
            draft = draft.slice(0, -1);
            return draw();
          }
          // Printable characters only: control keys carry names, not text, and must not reach the draft.
          if (str !== undefined && str.length === 1 && str >= ' ' && key.ctrl !== true) {
            draft += str;
            return draw();
          }
          return;
        }

        if (key.name === 'escape') return finish();
        if (key.name === 'up') {
          cursor = Math.max(0, cursor - 1);
          return draw();
        }
        if (key.name === 'down') {
          cursor = Math.min((options[tab]?.length ?? 1) - 1, cursor + 1);
          return draw();
        }
        if (key.name === 'left') return goToTab(tab - 1);
        if (key.name === 'right') return goToTab(tab + 1);
        if (key.name === 'return' || key.name === 'enter') {
          if (tab === reviewTab) return finish(); // the Review tab's Enter is the submit
          return confirmOption();
        }
      };
      stdin.on('keypress', onKey);
    });
    erase();
  } finally {
    for (const listener of suspended) stdin.on('keypress', listener);
    stdin.setRawMode(priorRaw);
  }

  writeTranscript(phase, questions, answers);
  return { answers };
}

/**
 * Print the permanent record of the exchange: the live panel is gone, so this is what the user (and
 * their scrollback) keeps. Append-only and copyable, like every other line in the conversation.
 */
function writeTranscript(phase: string, questions: readonly AskQuestion[], answers: readonly (string | null)[]): void {
  const width = terminalColumns();
  const answered = answers.filter((answer) => answer !== null).length;
  stdout.write(`${theme.phase(phase)(`${phase} asked`)} ${theme.meta(`· ${answered} of ${questions.length} answered`)}\n`);
  questions.forEach((question, index) => {
    const answer = answers[index];
    stdout.write(`  ${theme.meta(`${index + 1}.`)} ${truncateToWidth(question.question, width - 5)}\n`);
    if (answer === undefined || answer === null) {
      stdout.write(`     ${theme.meta(truncateToWidth('saved — answer it later with /questions', width - 6))}\n`);
    } else {
      stdout.write(`     ${theme.success(`→ ${truncateToWidth(answer, width - 8)}`)}\n`);
    }
  });
}
