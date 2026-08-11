// Input to formatToolCallLine — everything the `→` line needs, so the formatter reads no globals and
// stays verifiable in isolation (state in, one string out, draws nothing).

/** One tool call, about to be recorded in the scrollback. */
export interface ToolCallLineInput {
  /** Tool name as dispatched, e.g. `read_file`. */
  readonly tool: string;
  /** The model's normalized arguments — toolCallSubject picks the one field that names the call. */
  readonly args: Record<string, unknown>;
  /** Terminal width in columns; everything but a path is truncated to fit it. */
  readonly width: number;
  /**
   * The SHORT id of the sub-agent that made the call, when it was not the phase itself. Present means
   * two things: the line is indented under its parent's own call line, and it carries a `[sub:abcd]`
   * marker — a sub-agent's twenty calls stay legible as somebody else's work.
   */
  readonly subagentShortId?: string;
}
