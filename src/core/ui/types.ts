// The vocabulary core/ui speaks that no single function owns. Types whose owner is obvious live with
// that function (constitution: a type lives in the file that owns the function it describes); what
// lands here is what several files speak and none of them defines — a tool-call display contract, an
// output sink handed between the renderer and the turn loop, and the keypress protocol two separate
// captures share.

import type { Key } from 'node:readline';

/** A `keypress` listener as `emitKeypressEvents` emits them: the decoded string plus the parsed key. */
export type KeypressListener = (str: string | undefined, key: Key | undefined) => void;

/**
 * The slice of the input stream a keypress capture needs — `process.stdin` in the app, a plain stream
 * in a verification script. Depending on the three methods rather than on NodeJS.ReadStream is what
 * lets a binding be driven directly without a terminal. Spoken by bind-newline-key.ts and
 * capture-type-ahead.ts, defined by neither.
 *
 * `listeners` is typed as unknown[] because EventEmitter declares it as Function[], which does not
 * narrow to a specific signature; the callers cast what they take back, exactly as ask-questions.ts does.
 */
export interface KeypressSource {
  listeners(eventName: 'keypress'): readonly unknown[];
  on(eventName: 'keypress', listener: KeypressListener): unknown;
  off(eventName: 'keypress', listener: KeypressListener): unknown;
}

/**
 * A single assistant turn's output sink: raw deltas in, formatted markdown on screen.
 *
 * Owned by no one function: create-markdown-stream.ts builds one, renderer.ts wraps one, and
 * core/session/turn-loop.ts holds one for the length of a turn.
 */
export interface MarkdownStream {
  /** Feed one streamed delta. Prints immediately; completed lines are repainted formatted. */
  push(delta: string): void;
  /** Finish the turn: render any trailing line the model left without a newline. */
  end(): void;
  /**
   * Print `block` ABOVE the line currently streaming, then put that line back under the cursor. For
   * anything that must reach the scrollback mid-turn (a queued message) without shredding the
   * half-written line it would otherwise land in the middle of.
   */
  interject(block: string): void;
}

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
