// One frame of the ask_user widget, as an array of lines. Pure: state in, lines out — it draws
// nothing and reads no input (ask-questions.ts owns the terminal and the keys). Keeping the frame a
// value makes the panel's look reviewable on its own, and the redraw loop trivially correct.
//
// HARD INVARIANT: every returned line occupies EXACTLY ONE terminal row. The widget redraws by
// moving the cursor up by `lines.length`, so a single line that wrapped would put the cursor a row
// off and smear the panel down the screen on every keypress. Hence every variable-length string is
// truncated to a computed budget before it is styled — by the five row builders composed here, each
// of which owns one part of the frame and does that truncation itself.

import type { AskQuestion } from './ask-questions.js';
import { panelHint } from './panel-hint.js';
import { panelQuestionBody } from './panel-question-body.js';
import { panelReviewBody } from './panel-review-body.js';
import { panelTabBar } from './panel-tab-bar.js';
import { panelTitle } from './panel-title.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

/** How the widget is currently reading input: picking from the list, or typing a free-text answer. */
export type QuestionPanelMode = 'select' | 'text';

/** Everything this file needs to draw one frame. A snapshot — the panel is pure. */
export interface QuestionPanelState {
  /** Who is asking, for the panel's title (the active phase name). */
  readonly phase: string;
  readonly questions: readonly AskQuestion[];
  /** Index-aligned with `questions`: the model's options PLUS the appended free-text choice. */
  readonly options: readonly (readonly string[])[];
  /** Index-aligned with `questions`: the answer so far, or null. */
  readonly answers: readonly (string | null)[];
  /** Active tab: 0..questions.length-1 are questions, questions.length is the Review tab. */
  readonly tab: number;
  /** Highlighted option within the active question. */
  readonly cursor: number;
  readonly mode: QuestionPanelMode;
  /** The free-text being typed, when mode is 'text'. */
  readonly draft: string;
}

/** Draw the whole frame: a ruled panel whose body is either a question tab or the Review tab. */
export function renderQuestionPanel(state: QuestionPanelState): string[] {
  const width = terminalColumns();
  const rule = theme.divider('─'.repeat(width));
  const isReview = state.tab >= state.questions.length;
  // panelReviewBody / panelQuestionBody: the tab's rows — every question with its answer so far, or
  // the active question and its options. panelTitle, panelTabBar and panelHint own one row each.
  const body = isReview ? panelReviewBody(state, width) : panelQuestionBody(state, width);
  return [
    rule,
    panelTitle(state, width),
    panelTabBar(state, width),
    '',
    ...body,
    '',
    panelHint(state, isReview, width),
    rule,
  ];
}
