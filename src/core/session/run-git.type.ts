// The outcome of one git invocation. Never an exception: a non-zero exit is data, because every
// caller here turns a git failure into a structured recoverable message for the model rather than
// letting it kill the turn.

export interface GitRun {
  /** True when git exited 0. */
  readonly ok: boolean;
  readonly stdout: string;
  /** git's stderr, trimmed. Populated on failure — and on success for commands that report there. */
  readonly stderr: string;
}
