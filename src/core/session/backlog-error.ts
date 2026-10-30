// The typed backlog failure: a missing tree, malformed frontmatter, an unknown task or status. It is
// a distinct error class so a caller can tell "the backlog is wrong" from any other throw and show the
// message plus a hint to have the Breakdown phase rewrite the file, rather than crashing the session.

/** Typed backlog failure (missing tree, malformed frontmatter, unknown task/status). */
export class BacklogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BacklogError';
  }
}
