// What a tool tells the SCROLLBACK about the call it just finished — the `←` result line, and the
// diff when the call changed a file (tool-diff-display.type.ts).
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
//
// Its own module because no function owns it: eight files name it and not one of them defines the
// contract. src/tools fills it in (build-write-display.ts returns one, and every other tool sets it on
// its result), core/session carries it through dispatch and onto the stored tool-call record, and
// core/ui prints it (format-tool-result-lines.ts).

import type { ToolDiffDisplay } from './tool-diff-display.type.js';

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
