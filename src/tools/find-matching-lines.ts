// findMatchingLines — the line numbers of one file that hold the pattern, cut to a limit, plus how
// many further matches were left behind. Pure: it reads no files and knows nothing about output.
//
// The per-file limit is what stops one hot file consuming the whole result. Reporting `omitted`
// alongside is the other half of that: a file cut to its first 20 matches must not look like a file
// with exactly 20 matches, or the model concludes it has seen every use of the symbol it searched for.

import type { MatchedLines } from './search-in-files.type.js';

/**
 * Scan `lines` for `needle`.
 *
 * When `foldCase` is true, `needle` must ALREADY be lower-cased by the caller — folding it once per
 * search rather than once per line. `String.prototype.toLowerCase` is used (not the locale variant),
 * so the fold cannot change with the host's locale.
 *
 * `limit` is a hard stop on the returned line numbers; scanning continues past it only to count what
 * was omitted, which is cheap next to reading the file and is what makes the cut visible.
 */
export function findMatchingLines(
  lines: readonly string[],
  needle: string,
  foldCase: boolean,
  limit: number,
): MatchedLines {
  const matched: number[] = [];
  let omitted = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const haystack = foldCase ? line.toLowerCase() : line;
    if (!haystack.includes(needle)) continue;
    if (matched.length < limit) {
      matched.push(index + 1); // 1-based: line numbers as a human and a model count them
    } else {
      omitted += 1;
    }
  }
  return { lines: matched, omitted };
}
