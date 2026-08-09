// Types for renderNumberedSlice. What a bounded read produced, and what stopped it — the notice is
// built from these fields alone, so the wording can never disagree with the bytes that were emitted.

/**
 * Why the slice ended.
 * - `end-of-file` — the last line of the file was emitted; nothing was withheld.
 * - `range` — the caller's own `limit` ran out while lines remained.
 * - `line-cap` — READ_FILE_LINE_LIMIT ran out while lines remained (the caller asked for no limit, or
 *   for one at least as large as the cap, so the cap is what actually stopped the read).
 * - `char-cap` — READ_FILE_CHAR_LIMIT ran out, usually part-way through a line.
 */
export type SliceStop = 'end-of-file' | 'range' | 'line-cap' | 'char-cap';

/** One rendered, bounded, line-numbered window onto a file. */
export interface NumberedSlice {
  /** The numbered rows, newline-joined. Empty only for an empty file. */
  readonly text: string;
  /** 1-based number of the first row shown (0 for an empty file). */
  readonly firstLine: number;
  /** 1-based number of the last row shown, counting a row that was cut part-way (0 for an empty file). */
  readonly lastLine: number;
  /** Lines in the whole file, as an editor counts them (a trailing newline ends a line, it does not add one). */
  readonly totalLines: number;
  /** Character the first row started at within its line — 0 for an ordinary read, non-zero when paging a long line. */
  readonly charOffset: number;
  /** 0-based `offset` that continues this read, or null when the file ended here and there is nothing to ask for. */
  readonly nextOffset: number | null;
  /**
   * `char_offset` to pair with `nextOffset`. Non-zero only when the last row was cut part-way through
   * its line: continuing then means resuming INSIDE that line, which is the only thing that guarantees
   * progress on a line longer than the whole budget.
   */
  readonly nextCharOffset: number;
  readonly stoppedBy: SliceStop;
  /** True when the last row shown is only part of its line, so re-reading must start AT that line, not after it. */
  readonly cutMidLine: boolean;
}

/**
 * Either a slice, or one of the two starting points the renderer refuses: a line `offset` at or past
 * the last line, and a `charOffset` at or past the end of that line. Both are reported rather than
 * silently returning nothing, so the tool can hand the model the real length it overshot instead of an
 * empty result it would read as "there is nothing there".
 */
export type NumberedSliceResult =
  | ({ readonly ok: true } & NumberedSlice)
  | { readonly ok: false; readonly past: 'end-of-file'; readonly totalLines: number }
  | { readonly ok: false; readonly past: 'end-of-line'; readonly lineNumber: number; readonly lineLength: number };
