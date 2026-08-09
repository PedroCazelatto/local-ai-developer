// renderFileMatches — one file's matches as output lines. The two formats search_in_files can emit
// both live here, because which one is right is decided by a single fact (was context asked for?) and
// splitting them would need a third function to choose between them.
//
// - `context_lines: 0` — the flat, unchanged `path:line: text` per match. Every row carries its own
//   path, which is what makes a one-line answer copyable and citable on its own.
// - `context_lines: N` — the path once as a header, then numbered rows: `→` marks a match, `|` marks
//   context, and `--` marks a jump to a later part of the same file. The path is not repeated per row
//   because with context there are many rows per path, and repeating it is the largest avoidable cost
//   in the result.
//
// Rows are right-trimmed. A trailing tab in the source must not become trailing tokens in the window,
// and CRLF files leave a `\r` on every line that the trim removes (the caller splits on '\n' only).

import { mergeLineRanges } from './merge-line-ranges.js';
import type { MatchedLines } from './search-in-files.type.js';

/**
 * The output lines for `relativePath`, in order, ready to be counted against the line budget.
 *
 * `lines` is the whole file, split on '\n'. `matched` is what findMatchingLines returned for it —
 * including `omitted`, which is rendered as its own closing row so a file cut at the per-file cap
 * never reads as a file that simply had that many matches.
 */
export function renderFileMatches(
  relativePath: string,
  lines: readonly string[],
  matched: MatchedLines,
  contextLines: number,
): string[] {
  // Deliberately does not name WHICH ceiling dropped them: the per-file cap is the usual one, but the
  // global match cap takes over on the last file scanned, and a note that named the wrong cap would
  // send the model to the wrong argument to fix it.
  const omittedNote =
    matched.omitted > 0 ? `... ${matched.omitted} more matches in this file, not shown.` : null;

  if (contextLines === 0) {
    const rows = matched.lines.map((line) => `${relativePath}:${line}: ${lines[line - 1] ?? ''}`.trimEnd());
    if (omittedNote !== null) rows.push(`${relativePath}: ${omittedNote}`);
    return rows;
  }

  // mergeLineRanges expands each match by `contextLines` either side and fuses the spans that touch,
  // so overlapping context is printed once rather than per match.
  const ranges = mergeLineRanges(matched.lines, contextLines, lines.length);
  const isMatch = new Set(matched.lines);
  // Pad every number to the widest one in this file's output, so the text starts in one column and a
  // block of code reads as a block of code.
  const gutter = String(ranges[ranges.length - 1]?.end ?? 0).length;

  const rows: string[] = [relativePath];
  ranges.forEach((range, index) => {
    if (index > 0) rows.push('  --'); // a jump to a later part of the same file, never a fused span
    for (let line = range.start; line <= range.end; line += 1) {
      const marker = isMatch.has(line) ? '→' : '|';
      rows.push(`  ${String(line).padStart(gutter, ' ')} ${marker} ${lines[line - 1] ?? ''}`.trimEnd());
    }
  });
  if (omittedNote !== null) rows.push(`  ${omittedNote}`);
  return rows;
}
