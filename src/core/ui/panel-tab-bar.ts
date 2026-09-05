// The ask_user panel's tab strip: `[1 ✓] · 2 · 3 · Review`, the active tab in the phase color and the
// answered ones check-marked.
//
// Cannot be truncated like the panel's other lines: it is already styled, and a cut could land inside
// an escape sequence and leak half of it to the screen. So it is MEASURED, and a bar too wide for the
// terminal collapses to a compact `2/3 · Review` that says the same thing in a fifth of the columns.

import { PANEL_INDENT } from './panel-indent.js';
import type { QuestionPanelState } from './render-question-panel.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';
import { visibleWidth } from './visible-width.js';

/** `[1 ✓] · 2 · 3 · Review` — the active tab in the phase color, answered ones check-marked. */
export function panelTabBar(state: QuestionPanelState, width: number): string {
  const onReview = state.tab >= state.questions.length;
  const tabs = state.questions.map((_question, index) => {
    const label = `${index + 1}${state.answers[index] !== null ? ' ✓' : ''}`;
    if (index === state.tab) return theme.phase(state.phase)(`[${label}]`);
    return state.answers[index] !== null ? theme.success(label) : theme.meta(label);
  });
  const review = onReview ? theme.phase(state.phase)('[Review]') : theme.meta('Review');
  const bar = [...tabs, review].join(theme.meta(' · '));
  // visibleWidth: the printed columns, escape sequences excluded — the bar is already styled.
  if (visibleWidth(bar) <= width - 1) return `${PANEL_INDENT}${bar}`;
  const position = onReview ? 'Review' : `${state.tab + 1}/${state.questions.length}`;
  return `${PANEL_INDENT}${theme.phase(state.phase)(truncateToWidth(position, width - 1))}`;
}
