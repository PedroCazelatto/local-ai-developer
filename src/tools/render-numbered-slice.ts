// The bounded, line-numbered window read_file returns. Two caps run at once and the first to run out
// wins: lines are the unit the model reasons in and the unit `offset`/`limit` are expressed in, but
// lines are not what bounds num_ctx — one minified bundle is three lines and two megabytes. The
// character cap is the backstop that makes the line cap safe to state.
//
// Numbering is the half that stops a SECOND read: with `12→` in front of every line the model can cite
// file:line, lift an exact `old_string` for edit_file, and come back with `offset: 340, limit: 60`
// instead of paying for the whole file again.
//
// `charOffset` is the escape hatch that keeps the promise the notice makes. A line longer than the
// whole budget can never be finished by asking for the next LINE — the read would return the same
// bytes forever — so a cut row is continued at the character it stopped on instead.

/** Lines returned when the caller names no `limit` — and the ceiling on one it does name. */
export const READ_FILE_LINE_LIMIT = 250;

/**
 * Character ceiling on a read AND on any single line within it. One number covers both: the per-read
 * budget is the binding one (a row can never outgrow the read that holds it), so the per-line rule is
 * what the same constant means when a single line is all the read contains.
 *
 * Deliberately NOT the shell tools' DEFAULT_OUTPUT_LIMIT. A file dump is re-askable in ranges and the
 * model reaches for it constantly; a command's output is neither, so they are tuned apart.
 */
export const READ_FILE_CHAR_LIMIT = 5_000;

// What a bounded read produced, and what stopped it — the notice is built from these fields alone,
// so the wording can never disagree with the bytes that were emitted.

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

/**
 * Render lines [offset, offset+limit) of `text` as numbered rows, stopping at whichever cap runs out
 * first. `offset` is 0-based and `charOffset` starts the FIRST row part-way into its line (0 for an
 * ordinary read); `requestedLimit` is null when the caller named none, and is clamped down to
 * READ_FILE_LINE_LIMIT — the model may narrow the read, never widen it (as with git_inspect's
 * `count`). Returns `ok: false` when either starting point is past the end of what it addresses.
 */
export function renderNumberedSlice(
  text: string,
  offset: number,
  requestedLimit: number | null,
  charOffset: number,
): NumberedSliceResult {
  const lines = text.split('\n');
  // A trailing newline terminates the last line rather than starting an empty one — drop the empty
  // tail element so totalLines agrees with what an editor and `wc -l` report.
  if (lines[lines.length - 1] === '') lines.pop();
  const totalLines = lines.length;

  if (totalLines === 0) {
    return {
      ok: true,
      text: '',
      firstLine: 0,
      lastLine: 0,
      totalLines: 0,
      charOffset: 0,
      nextOffset: null,
      nextCharOffset: 0,
      stoppedBy: 'end-of-file',
      cutMidLine: false,
    };
  }
  if (offset >= totalLines) {
    return { ok: false, past: 'end-of-file', totalLines };
  }
  const firstLineText = lines[offset] ?? '';
  if (charOffset > 0 && charOffset >= firstLineText.length) {
    return { ok: false, past: 'end-of-line', lineNumber: offset + 1, lineLength: firstLineText.length };
  }

  const limit = requestedLimit === null ? READ_FILE_LINE_LIMIT : Math.min(requestedLimit, READ_FILE_LINE_LIMIT);
  const limitIsCap = requestedLimit === null || requestedLimit >= READ_FILE_LINE_LIMIT;
  const end = Math.min(offset + limit, totalLines);
  // Column width comes from the whole file, not from this slice, so two reads of the same file line up
  // against each other however they were sliced — widened only when the resumed first row carries a
  // `+chars` marker longer than a plain line number.
  const firstLabel = charOffset > 0 ? `${offset + 1}+${charOffset}` : `${offset + 1}`;
  const width = Math.max(String(totalLines).length, firstLabel.length);

  const rows: string[] = [];
  let used = 0;
  let lastLine = 0;
  let cutMidLine = false;
  let charCapHit = false;
  let nextCharOffset = 0;

  for (let index = offset; index < end; index += 1) {
    // Only the first row can start mid-line; every row after it begins at its line's first character.
    const startChar = index === offset ? charOffset : 0;
    const label = index === offset ? firstLabel : String(index + 1);
    const prefix = `${label.padStart(width)}→`;
    // Line text is emitted verbatim, trailing whitespace and a CRLF's \r included: what the model reads
    // has to be byte-identical to the file, or an old_string copied out of it stops matching.
    const row = `${prefix}${(lines[index] ?? '').slice(startChar)}`;
    const separator = rows.length === 0 ? 0 : 1; // the newline joining this row to the previous one
    if (used + separator + row.length <= READ_FILE_CHAR_LIMIT) {
      rows.push(row);
      used += separator + row.length;
      lastLine = index + 1;
      continue;
    }
    // The budget ran out inside this line. Keep the part that fits — but only when there is room for the
    // number plus at least one character of content, since a bare `13→` tells the model nothing.
    const room = READ_FILE_CHAR_LIMIT - used - separator;
    if (room > prefix.length) {
      const kept = row.slice(0, room);
      rows.push(kept);
      lastLine = index + 1;
      cutMidLine = true;
      nextCharOffset = startChar + kept.length - prefix.length;
    }
    charCapHit = true;
    break;
  }

  const stoppedBy: SliceStop = charCapHit
    ? 'char-cap'
    : end >= totalLines
      ? 'end-of-file'
      : limitIsCap
        ? 'line-cap'
        : 'range';

  return {
    ok: true,
    text: rows.join('\n'),
    firstLine: offset + 1,
    lastLine,
    totalLines,
    charOffset,
    // A cut line is only half-delivered, so continuing means resuming INSIDE that line, not after it.
    nextOffset: cutMidLine ? lastLine - 1 : lastLine >= totalLines ? null : lastLine,
    nextCharOffset,
    stoppedBy,
    cutMidLine,
  };
}
