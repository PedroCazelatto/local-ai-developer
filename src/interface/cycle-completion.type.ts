// Types for cycle-completion.ts (constitution: types live in a sibling file, never inline).

import type { ReplOrchestrator } from './repl.js';

/**
 * A Tab cycle in flight: the candidate words, which one is sitting in the line right now, and where in
 * the line that word starts. The REPL holds one across consecutive Tab presses and drops it the moment
 * any other key arrives.
 *
 * The candidates are captured ONCE, when the cycle starts, and are never recomputed while it runs. That
 * is deliberate: they come off the backlog on disk, and a file changing under a `/run` mid-cycle would
 * otherwise renumber the list between two presses and cycle the user somewhere they were not heading.
 */
export interface CompletionCycle {
  /** Every candidate for this position, in the stable order complete-line.ts sorted them into. */
  readonly candidates: readonly string[];
  /** Which candidate is currently in the line — the next press takes `(index + 1) % candidates.length`. */
  readonly index: number;
  /** Offset in the line where the completed word begins; the word runs from here to the cursor. */
  readonly start: number;
}

/** The edit one Tab press resolves to: the whole new line, where the cursor lands, and the cycle to carry on. */
export interface CompletionStep {
  readonly line: string;
  readonly cursor: number;
  readonly cycle: CompletionCycle;
}

/** Everything cycle-completion.ts needs to resolve one Tab press: the live buffer, and the cycle so far. */
export interface CompletionInput {
  /** readline's whole edit buffer, which may hold text to the RIGHT of the cursor. */
  readonly line: string;
  /** readline's cursor offset into `line` — the completed word ends here. */
  readonly cursor: number;
  /** The session orchestrator, which is where a command's completer finds its live candidates. */
  readonly orch: ReplOrchestrator;
  /** The cycle the previous Tab left behind, or null when the last key was anything else. */
  readonly active: CompletionCycle | null;
}
