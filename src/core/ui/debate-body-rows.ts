// One debate turn's prose, turned into the finished terminal rows render-debate-turn.ts prints under
// the turn's header.
//
// Each line is classified and styled by the SAME renderer the streamed reply uses (so a list in an
// objection renders as a list), then word-wrapped with a hanging indent.
//
// `insideFence` is threaded across lines because it is the only state markdown carries — and a line
// inside a ``` fence is left unwrapped, since its spaces are significant.

import { renderMarkdownLine } from './render-markdown-line.js';
import { terminalColumns } from './terminal-columns.js';
import { wordWrap } from './word-wrap.js';

/** Two spaces, so a turn's prose reads as subordinate to its header without a drawn gutter. */
const INDENT = '  ';

/** `body` as finished, styled, wrapped terminal rows — indented under the turn header. */
export function debateBodyRows(body: string): string[] {
  const rows: string[] = [];
  let insideFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (line.trim() === '' && !insideFence) {
      rows.push(''); // a paragraph break stays a bare blank row, never an indent full of spaces
      continue;
    }
    const wasInsideFence = insideFence;
    // renderMarkdownLine: one line classified and styled, plus the fence state the NEXT line needs.
    const rendered = renderMarkdownLine(line, insideFence);
    insideFence = rendered.insideFence;
    const indented = `${INDENT}${rendered.text}`;
    // wordWrap re-applies the leading indent to every wrapped row and closes/reopens styling across the
    // break; code inside a fence is written verbatim instead, spaces intact.
    rows.push(...(wasInsideFence ? [indented] : wordWrap(indented, terminalColumns())));
  }
  return rows;
}
