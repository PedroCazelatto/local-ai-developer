// Print one debate turn into the scrollback: a colored role header, then the turn's prose rendered as
// markdown and indented under it. The user watches the argument happen rather than being handed a
// verdict with no visible reasoning — the digest goes to the model, the transcript goes to the user.
//
// Append-only, like everything else in history (constitution, Terminal UX): the block is written once
// and never revisited. It goes out through renderer.interjectLine because a debate runs INSIDE a tool
// call, where the transient activity line owns the cursor row — interjectLine lifts it, writes, and puts
// it back. Writing to stdout directly here would print through that line.

import type { DebateTurnView } from './render-debate-turn.type.js';
import { renderMarkdownLine } from './render-markdown-line.js';
import * as renderer from './renderer.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';
import { wordWrap } from './word-wrap.js';

/** Two spaces, so a turn's prose reads as subordinate to its header without a drawn gutter. */
const INDENT = '  ';

/** Print `turn` as one block: blank line, header, indented body. */
export function renderDebateTurn(turn: DebateTurnView): void {
  const style = turn.role === 'challenger' ? theme.debate.challenger : theme.debate.proponent;
  const suffix = turn.conceded ? ' · conceded' : '';
  const header = style(`${turn.role} ▸ round ${turn.round}${suffix}`);
  renderer.interjectLine(['', header, ...bodyRows(turn.body)].join('\n'));
}

/**
 * The body as finished terminal rows: each line classified and styled by the SAME renderer the streamed
 * reply uses (so a list in an objection renders as a list), then word-wrapped with a hanging indent.
 *
 * `insideFence` is threaded across lines because it is the only state markdown carries — and a line
 * inside a ``` fence is left unwrapped, since its spaces are significant.
 */
function bodyRows(body: string): string[] {
  const rows: string[] = [];
  let insideFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (line.trim() === '' && !insideFence) {
      rows.push(''); // a paragraph break stays a bare blank row, never an indent full of spaces
      continue;
    }
    const wasInsideFence = insideFence;
    const rendered = renderMarkdownLine(line, insideFence);
    insideFence = rendered.insideFence;
    const indented = `${INDENT}${rendered.text}`;
    // wordWrap re-applies the leading indent to every wrapped row and closes/reopens styling across the
    // break; code inside a fence is written verbatim instead, spaces intact.
    rows.push(...(wasInsideFence ? [indented] : wordWrap(indented, terminalColumns())));
  }
  return rows;
}
