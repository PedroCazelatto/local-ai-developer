// The `→` line: one tool call, named by the argument that says what it did.
//
//   → read_file src/core/ui/theme.ts
//   → run_in_project npm test
//   → search_in_files "resolveInProject" in *.ts
//     → read_file src/tools/context.ts [sub:01JQ]
//
// Pure — state in, one styled string out, nothing drawn. It is printed BEFORE the call runs (that is
// the point: the record appears while the work is happening), so it can only ever know the arguments.
// The result arrives separately, on the `←` line.
//
// TWO width rules, and they disagree on purpose:
//   - a PATH is never truncated. A row that overflows wraps, which is harmless here because this is
//     static append-only history: nothing ever moves the cursor back over it, so a wrapped row costs
//     a row and no correctness. A cut path costs the basename, which is the part that identifies it.
//   - everything else goes through truncateToWidth like every other measured row, so a pasted
//     thousand-character shell command cannot flood the buffer.
// The `[sub:…]` marker is reserved out of the budget rather than truncated with the subject: losing it
// would make a sub-agent's call read as the phase's own.

import { theme } from './theme.js';
import { toolCallSubject } from './tool-call-subject.js';
import type { ToolCallLineInput } from './format-tool-call-line.type.js';
import { truncateToWidth } from './truncate-to-width.js';
import { visibleWidth } from './visible-width.js';

/** How far a sub-agent's calls sit under the parent call that spawned them. */
export const SUBAGENT_INDENT = '  ';

/**
 * Columns held back from every truncated row, so a cut line lands one short of the right margin
 * instead of exactly filling it. truncateToWidth returns EXACTLY `width` characters whenever it cuts,
 * and a row that fills the terminal exactly costs a second row on the terminals that wrap eagerly —
 * so without this, every truncated tool line would be followed by a blank one.
 */
export const RIGHT_MARGIN = 1;

/** The finished, styled `→` line for one tool call. Never contains a newline. */
export function formatToolCallLine(input: ToolCallLineInput): string {
  const indent = input.subagentShortId === undefined ? '' : SUBAGENT_INDENT;
  const marker = input.subagentShortId === undefined ? '' : ` [sub:${input.subagentShortId}]`;
  const head = `${indent}→ ${input.tool}`;

  // toolCallSubject: the one argument that names this call, per the per-tool table, already folded to
  // one line and stripped of anything that could move the cursor.
  const subject = toolCallSubject(input.tool, input.args);
  if (subject.text === '') {
    return theme.meta(`${head}${marker}`);
  }
  if (subject.isPath) {
    return theme.meta(`${head} ${subject.text}${marker}`);
  }
  const budget = input.width - visibleWidth(head) - visibleWidth(marker) - 1 - RIGHT_MARGIN; // -1: the space
  return theme.meta(`${head} ${truncateToWidth(subject.text, budget)}${marker}`);
}
