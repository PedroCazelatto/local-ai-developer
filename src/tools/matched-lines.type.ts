// The matching lines of one file. Folder vocabulary: findMatchingLines produces it and
// renderFileMatches prints it -- two peers, neither owning the record they pass between them.

/** The matching lines of ONE file, already cut to the per-file ceiling. */
export interface MatchedLines {
  /** 1-based line numbers holding the pattern, ascending, no more than the limit allowed. */
  readonly lines: readonly number[];
  /** Matches this file holds BEYOND the ones above — 0 when nothing was dropped. */
  readonly omitted: number;
}
