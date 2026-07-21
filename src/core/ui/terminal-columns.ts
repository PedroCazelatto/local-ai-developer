// The terminal's width in columns, with a sane fallback. Shared by everything that has to fit or
// measure a line: the markdown stream (how many rows a raw line wrapped onto), the markdown line
// renderer (how wide to draw a `---` rule), the input rules, and the question panel.
//
// The fallback matters off a TTY (piped/redirected), where stdout reports no size at all: callers
// still need a number, and 80 is the classic terminal default.

import { stdout } from 'node:process';

/** Fallback width when stdout reports no column count (piped/redirected, or a non-TTY). */
const DEFAULT_COLUMNS = 80;

/** Current terminal width in columns, or 80 when unknown. */
export function terminalColumns(): number {
  const cols = stdout.columns;
  return typeof cols === 'number' && cols > 0 ? cols : DEFAULT_COLUMNS;
}
