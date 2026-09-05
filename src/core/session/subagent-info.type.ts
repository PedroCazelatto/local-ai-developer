// A read-only snapshot of one live sub-agent — one unowned type, in its own file because TWO functions
// produce one and neither is its owner: SubagentManager.list() builds them and
// SessionOrchestrator.listSubagents() returns them out to the interface layer. Two producers is not one
// owner, which is the reading that put MarkdownStream in its own file. It is also part of the
// SubagentHandle contract (see subagent-handle.type.ts), and keeping it out of subagents.ts is what
// stops that contract from having to import the manager it exists to hide.
//
// Consumers: `/subagents` (interface/commands/show-subagents.ts) and the token label beside each row
// (interface/commands/token-label.ts), both through core/session/index.ts.

/** A read-only snapshot of one sub-agent for `/subagents` and the status-line count. */
export interface SubagentInfo {
  readonly id: string;
  /** First few chars of `id` — the form shown in the `[sub:<short>]` history marker. */
  readonly shortId: string;
  readonly createdAt: number;
  /** Messages in its history (system brief + task + turns) — a cheap proxy for how far it has run. */
  readonly messageCount: number;
  /** EXACT cumulative counts; null means Ollama did not report the metric on some turn (surfaced, not guessed). */
  readonly promptTokens: number | null;
  readonly evalTokens: number | null;
}
