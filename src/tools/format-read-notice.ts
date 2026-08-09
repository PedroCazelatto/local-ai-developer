// The line every read_file result ends with. It is a guard, not a courtesy: a silently cut file is
// worse than a refused read, because the model reasons over a partial file believing it is whole and
// the Reviewer then reviews an edit founded on a file that does not exist.
//
// It is printed on EVERY read, including one that withheld nothing, so `of N` is always present — the
// model never has to remember or infer how long a file is, and one format covers every case.
//
// Whatever it names as the way to continue must actually advance. That is why a mid-line cut is
// resumed with a `char_offset` and not merely the same line again.

import { READ_FILE_CHAR_LIMIT, READ_FILE_LINE_LIMIT } from './render-numbered-slice.js';
import type { NumberedSlice } from './render-numbered-slice.type.js';

export function formatReadNotice(slice: NumberedSlice, path: string): string {
  if (slice.totalLines === 0) {
    return `[showed 0 lines — '${path}' is empty.]`;
  }
  const resumed =
    slice.charOffset > 0 ? `, line ${slice.firstLine} from character ${slice.charOffset.toLocaleString('en-US')}` : '';
  const range = `showed lines ${slice.firstLine}-${slice.lastLine} of ${slice.totalLines}${resumed}`;
  if (slice.nextOffset === null) {
    return `[${range}.]`;
  }

  const from =
    slice.nextCharOffset > 0 ? `offset: ${slice.nextOffset}, char_offset: ${slice.nextCharOffset}` : `offset: ${slice.nextOffset}`;
  // "the rest" when a cap fired, "more" when the caller's own limit is what ended the read.
  const more = `Ask for ${slice.stoppedBy === 'range' ? 'more' : 'the rest'} with ${from}.`;
  if (slice.stoppedBy === 'range') {
    return `[${range}. ${more}]`;
  }

  const cap =
    slice.stoppedBy === 'line-cap'
      ? `truncated at the ${READ_FILE_LINE_LIMIT}-line cap`
      : `truncated at the ${READ_FILE_CHAR_LIMIT.toLocaleString('en-US')}-character cap` +
        // Naming the cut line matters: that row is only part of its line, so an old_string copied from
        // it would not match, and the model needs to know which row to distrust.
        (slice.cutMidLine ? ` mid-line ${slice.lastLine}` : '');
  return `[${cap} — ${range}. ${more}]`;
}
