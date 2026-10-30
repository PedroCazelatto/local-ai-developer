// A token ceiling as /resume writes every other figure. Split out of resume.ts.
//
// Named ceilingLabel rather than the private `ceiling` it was extracted from: the bare noun names the
// value rather than the formatting, and `ceiling` is a word two dozen files in this repo use in prose
// for the num_ctx limit itself. This folder already spells "format this for display"
// `<thing>Label` — duration-label.ts, turn-label.ts, msg-label.ts, token-label.ts.

/** `16,384` — grouped, never abbreviated, because the listing writes every other figure that way. */
export function ceilingLabel(numCtx: number): string {
  return numCtx.toLocaleString('en-US');
}
