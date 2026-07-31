// One submitted user message as full-width gray bars — the static, copyable block that stands for the
// user's turn in the scrollback.
//
// Each row is padded by DISPLAY width (visibleWidth counts a CJK/emoji glyph as two columns) so the
// background spans the whole terminal row rather than stopping at the text.
//
// The breaks the user typed with Shift+Enter are structure, not overflow, so each of THEIR lines is
// wrapped on its own: a line break they chose can never be swallowed by refilling the paragraph, and a
// deliberately blank line stays a blank gray row.

import { INPUT_PROMPT } from './input-prompt.js';
import { theme } from './theme.js';
import { visibleWidth } from './visible-width.js';
import { wordWrap } from './word-wrap.js';

/** Display columns the ` › ` marker occupies; continuation rows of a wrapped message align under it. */
const USER_INDENT = 3;

/** `raw` as styled full-width rows, marker on the first, at `columns` wide. */
export function userMessageBars(raw: string, columns: number): string[] {
  const lines = raw
    .trim()
    .split('\n')
    .flatMap((source) => wordWrap(source, Math.max(1, columns - USER_INDENT)));
  return lines.map((text, index) => {
    const prefix = index === 0 ? ` ${INPUT_PROMPT}` : ' '.repeat(USER_INDENT);
    const row = `${prefix}${text}`;
    return theme.userMessage(row + ' '.repeat(Math.max(0, columns - visibleWidth(row))));
  });
}
