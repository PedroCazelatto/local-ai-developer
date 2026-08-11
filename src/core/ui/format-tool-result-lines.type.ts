// Input to formatToolResultLines — the finished call, as the audit record already describes it, plus
// the width to fit it into. Deliberately a flat view of ToolCallRecord rather than the record itself:
// the formatter is pure and belongs to the UI layer, and it has no business reading a session type.

import type { ToolCallDisplay } from './tool-call-display.type.js';

/** One finished tool call, about to be recorded in the scrollback. */
export interface ToolResultLinesInput {
  /** Tool name as dispatched — decides whether the elapsed time is worth showing. */
  readonly tool: string;
  /** 0 success, the real code for shell/container tools, -1 for any failure. */
  readonly exitStatus: number;
  /** null on success; the error message on failure — the fallback summary when the tool set none. */
  readonly error: string | null;
  /** Wall-clock around the call, in milliseconds. */
  readonly durationMs: number;
  /** What the tool itself wants said about the result. Absent for tools that say nothing. */
  readonly display?: ToolCallDisplay;
  /** Terminal width in columns; everything but a path is truncated to fit it. */
  readonly width: number;
  /** The SHORT id of the sub-agent that made the call — indents the block and marks it. */
  readonly subagentShortId?: string;
}
