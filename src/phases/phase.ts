// The Phase abstraction — the TS replacement for the Python Agent/"persona". A phase is just a
// name + its loaded instruction markdown + the tools it may use. There is NO "persona"/"role"
// vocabulary anywhere in the TS tree (hard terminology rule — CLAUDE.md / ROADMAP).

export interface Phase {
  /** Lowercased phase id, e.g. "discovery" (was Agent.role). */
  readonly name: string;
  /** Full markdown of rules/phases/<name>.md (was Agent.persona, which held the file text). */
  readonly instructions: string;
  /**
   * Tool names available to this phase. Empty for Foundation and NOT gated in code — a phase is
   * told which tools to reach for in its markdown, not whitelisted here (CLAUDE.md). Real tool
   * definitions are wired in V1.
   */
  readonly tools: string[];
}
