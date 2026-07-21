// One frame of the ask_user widget, as an array of lines. Pure: state in, lines out — it draws
// nothing and reads no input (ask-questions.ts owns the terminal and the keys). Keeping the frame a
// value makes the panel's look reviewable on its own, and the redraw loop trivially correct.
//
// HARD INVARIANT: every returned line occupies EXACTLY ONE terminal row. The widget redraws by
// moving the cursor up by `lines.length`, so a single line that wrapped would put the cursor a row
// off and smear the panel down the screen on every keypress. Hence every variable-length string is
// truncated to a computed budget before it is styled.

import { truncateToWidth } from './truncate-to-width.js';
import type { QuestionPanelState } from './ask-questions.type.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';
import { visibleWidth } from './visible-width.js';

/** Left margin of every line inside the panel. */
const INDENT = ' ';
/** Marker on the highlighted option. */
const CURSOR = '▸';
/** Shown in the Review tab for a question the user moved past. */
const UNANSWERED = 'not answered — saved for /questions';

/** Draw the whole frame: a ruled panel whose body is either a question tab or the Review tab. */
export function renderQuestionPanel(state: QuestionPanelState): string[] {
  const width = terminalColumns();
  const rule = theme.divider('─'.repeat(width));
  const isReview = state.tab >= state.questions.length;
  const body = isReview ? reviewBody(state, width) : questionBody(state, width);
  return [rule, title(state, width), tabBar(state, width), '', ...body, '', hint(state, isReview, width), rule];
}

/** `discovery asks · 2 of 3 answered` — who is waiting on you, and how far along you are. */
function title(state: QuestionPanelState, width: number): string {
  const answered = state.answers.filter((answer) => answer !== null).length;
  const text = `${state.phase} asks · ${answered} of ${state.questions.length} answered`;
  return `${INDENT}${theme.phase(state.phase)(truncateToWidth(text, width - 1))}`;
}

/**
 * `[1 ✓] · 2 · 3 · Review` — the active tab in the phase color, answered ones check-marked.
 *
 * Cannot be truncated like the other lines: it is already styled, and a cut could land inside an
 * escape sequence and leak half of it to the screen. So it is MEASURED, and a bar too wide for the
 * terminal collapses to a compact `2/3 · Review` that says the same thing in a fifth of the columns.
 */
function tabBar(state: QuestionPanelState, width: number): string {
  const onReview = state.tab >= state.questions.length;
  const tabs = state.questions.map((_question, index) => {
    const label = `${index + 1}${state.answers[index] !== null ? ' ✓' : ''}`;
    if (index === state.tab) return theme.phase(state.phase)(`[${label}]`);
    return state.answers[index] !== null ? theme.success(label) : theme.meta(label);
  });
  const review = onReview ? theme.phase(state.phase)('[Review]') : theme.meta('Review');
  const bar = [...tabs, review].join(theme.meta(' · '));
  if (visibleWidth(bar) <= width - 1) return `${INDENT}${bar}`;
  const position = onReview ? 'Review' : `${state.tab + 1}/${state.questions.length}`;
  return `${INDENT}${theme.phase(state.phase)(truncateToWidth(position, width - 1))}`;
}

/** The active question and its options — or the free-text editor when the user picked "Other". */
function questionBody(state: QuestionPanelState, width: number): string[] {
  const question = state.questions[state.tab];
  const options = state.options[state.tab];
  if (question === undefined || options === undefined) return []; // tab is always in range; never guess
  const prompt = `${INDENT}${theme.strong(truncateToWidth(question.question, width - 1))}`;
  if (state.mode === 'text') {
    return [prompt, '', ...textEditor(state, width)];
  }
  // Budget: indent + cursor + space + "N. " + text. Numbers are labels here — the keymap is arrows
  // only (they orient the eye and let the user refer to "option 3"), so no number-key handling.
  const optionWidth = width - 1 - 2 - String(options.length).length - 2;
  const lines = options.map((option, index) => {
    const number = theme.md.bullet(`${index + 1}.`);
    const text = truncateToWidth(option, optionWidth);
    if (index === state.cursor) {
      return `${INDENT}${theme.phase(state.phase)(CURSOR)} ${number} ${theme.md.bold(text)}`;
    }
    return `${INDENT}  ${number} ${text}`;
  });
  return [prompt, '', ...lines];
}

/** The single-line free-text editor shown after picking "Other", with a block cursor at the end. */
function textEditor(state: QuestionPanelState, width: number): string[] {
  const typed = truncateToWidth(state.draft, width - 4);
  return [`${INDENT}${theme.meta('›')} ${typed}${theme.md.bullet('▏')}`];
}

/** The Review tab: every question with the answer that will be submitted for it. */
function reviewBody(state: QuestionPanelState, width: number): string[] {
  const lines: string[] = [];
  state.questions.forEach((question, index) => {
    lines.push(`${INDENT}${theme.meta(`${index + 1}.`)} ${truncateToWidth(question.question, width - 5)}`);
    const answer = state.answers[index];
    const shown = truncateToWidth(answer ?? UNANSWERED, width - 7);
    lines.push(`${INDENT}   ${answer === null ? theme.meta(shown) : theme.success(`→ ${shown}`)}`);
  });
  return lines;
}

/** The keymap, restated every frame — the widget is transient, so nothing else can teach it. */
function hint(state: QuestionPanelState, isReview: boolean, width: number): string {
  const keys = state.mode === 'text'
    ? 'enter save · esc back to the options'
    : isReview
      ? 'enter submit · ←→ tab · esc close (unanswered are saved)'
      : '↑↓ choose · enter confirm & next · ←→ tab · esc close';
  return `${INDENT}${theme.meta(truncateToWidth(keys, width - 1))}`;
}
