// What a tool tells the SCROLLBACK about the call it just finished — the `←` result line, and the
// diff when the call changed a file.
//
// This rides on the tool result and on the audit record, but it is NOT audit data: appendAuditRow
// builds its JSONL row from an explicit field list, so nothing here reaches tool_audit.jsonl and a
// diff body never bloats the log. It exists because the dispatch choke point cannot derive these
// answers — only write_file and edit_file hold the file's bytes before AND after, and only
// search_in_files knows how many matches it stopped counting at. Parsing a tool's model-facing string
// back out at the choke point would be guessing at a contract that was never written down.
//
// A tool that sets nothing still gets a result line: the printer falls back to the tool's own error
// message (failed) or a plain `ok` (succeeded).

/** One tool call's contribution to the `←` line. */
export interface ToolCallDisplay {
  /**
   * The one-line summary, unstyled and without the `← ` marker: `340 lines`, `exit 0`,
   * `12 matches in 5 files`. Truncated to the terminal width when it does not fit.
   */
  readonly summary: string;
  /** Present only for a call that changed a file (write_file / edit_file / edit_phase_rule). */
  readonly diff?: ToolDiffDisplay;
}

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
