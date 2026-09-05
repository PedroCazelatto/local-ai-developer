// A list of digest lines, from whatever shape the distiller produced.
//
// A single string is accepted as a one-entry list, which is a common local-model shape; anything that
// is neither an array nor a string yields []. Unusable entries are DROPPED rather than turning the
// whole digest into a failure — the verdict is still readable without them, and only the verdict
// itself is undefaultable.
//
// Named digestLineList rather than the module-private `asLines` it was extracted from.

import { digestLine } from './digest-line.js';

/** How many entries either list may carry — a debate this small cannot honestly produce more. */
const LIST_LIMIT = 5;

/** A list of digest lines, de-duplicated and capped. Unusable entries are dropped. */
export function digestLineList(value: unknown): readonly string[] {
  const items = Array.isArray(value) ? value : [value];
  const lines: string[] = [];
  for (const item of items) {
    // digestLine: a non-empty single line, capped at 200 chars; null when unusable.
    const line = digestLine(item);
    if (line !== null && !lines.includes(line)) lines.push(line);
    if (lines.length === LIST_LIMIT) break;
  }
  return lines;
}
