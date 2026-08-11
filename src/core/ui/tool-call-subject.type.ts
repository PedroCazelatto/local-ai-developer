// What identifies one tool call on its `→` line.

/** The identifying argument of a tool call, plus whether it is a path (paths are never truncated). */
export interface ToolCallSubject {
  /**
   * The subject as it should read after the tool name, already stripped of control characters and
   * folded onto one line. EMPTY for a tool that takes no arguments (list_changes, git_push,
   * mark_task_done) — those are fully identified by their name alone.
   */
  readonly text: string;
  /**
   * True when `text` is a filesystem path. A path is NEVER truncated: it is the one string on the line
   * whose tail carries the meaning, and a cut path is worse than a wrapped row. Everything else — a
   * command, a search pattern, a prose claim — goes through truncateToWidth as usual.
   */
  readonly isPath: boolean;
}
