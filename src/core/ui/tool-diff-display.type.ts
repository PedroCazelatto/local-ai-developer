// The second half of the tool-call display contract — see tool-call-display.type.ts for what that
// contract is, and for why none of it is audit data. This is the part a write tool attaches when the
// call changed a file: the compact +/- diff, already reduced to the lines that actually changed.
//
// It stays here, in core/ui's vocabulary, rather than folding into buildFileDiff — which is the only
// function that builds one and, today, its only importer. Two things decide it. It is half of a
// contract this folder PRINTS and src/tools merely fills in: format-tool-result-lines.ts reads `path`
// and `lines` off it through ToolCallDisplay, while build-write-display.ts, edit-file.ts and
// retro-window.ts read the counts. And the alternative would have core/ui import a type out of
// src/tools, a direction no file in core/ui has today.

/** The compact +/- diff of one changed file, already reduced to the lines that actually changed. */
export interface ToolDiffDisplay {
  /** Project-relative path of the changed file. NEVER truncated when printed. */
  readonly path: string;
  /** Exact count of added lines. */
  readonly added: number;
  /** Exact count of removed lines. */
  readonly removed: number;
  /**
   * The changed lines, each already prefixed `+` or `-`. EMPTY when the change was over the collapse
   * caps (buildFileDiff decides), which is what turns the result line into `+12 −3 <path>` alone.
   */
  readonly lines: readonly string[];
}
