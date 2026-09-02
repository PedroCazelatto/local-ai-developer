// mergeLineRanges — expand matched line numbers into the spans of file to print, and fuse the spans
// that touch. Pure arithmetic over line numbers; it never sees the file's text.
//
// The fusing is the point. Two matches three lines apart with `context_lines: 3` describe overlapping
// spans, and printing both would send the shared rows twice — paying twice for the same tokens in a
// window sized in thousands. Spans that merely ABUT are fused too: printing 29-31 and 32-34 as two
// blocks would put a separator between rows that are already consecutive, which reads as a gap in the
// file where there is none.

import type { LineRange } from './line-range.type.js';

/**
 * The line spans to print for one file, ascending and non-overlapping.
 *
 * `matched` must be ascending 1-based line numbers (findMatchingLines returns them that way).
 * `totalLines` clamps the last span so context never runs off the end of the file.
 */
export function mergeLineRanges(
  matched: readonly number[],
  contextLines: number,
  totalLines: number,
): LineRange[] {
  const ranges: LineRange[] = [];
  for (const line of matched) {
    const start = Math.max(1, line - contextLines);
    const end = Math.min(totalLines, line + contextLines);
    const last = ranges[ranges.length - 1];
    // `last.end + 1` rather than `last.end`: adjacent spans are contiguous rows, so they fuse too.
    if (last !== undefined && start <= last.end + 1) {
      if (end > last.end) ranges[ranges.length - 1] = { start: last.start, end };
      continue;
    }
    ranges.push({ start, end });
  }
  return ranges;
}
