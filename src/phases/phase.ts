// The Phase abstraction — the TS replacement for the Python Agent/"persona". A phase is just a
// name + its loaded instruction markdown + the tools it may use. There is NO "persona"/"role"
// vocabulary anywhere in the TS tree (hard terminology rule — CLAUDE.md / ROADMAP).

export interface Phase {
  /** Lowercased phase id, e.g. "discovery" (was Agent.role). */
  readonly name: string;
  /** Full markdown of rules/phases/<name>.md (was Agent.persona, which held the file text). */
  readonly instructions: string;
  /**
   * Tool names available to this phase — its array from phase-tool-names.ts, resolved by the factory.
   * This IS the gate: resolvePhaseTools turns these names into the definitions sent to Ollama, so a
   * name absent here is a tool the phase never sees. The phase markdown still steers *which* tool to
   * reach for and when; this decides what is reachable at all.
   */
  readonly tools: readonly string[];
}
