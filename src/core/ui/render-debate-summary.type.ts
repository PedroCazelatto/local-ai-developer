// The view render-debate-summary.ts prints — the one line that closes a debate in the scrollback.
// Declared here rather than imported from core/session, so ui/ stays a leaf (see render-debate-turn.type.ts).

export interface DebateSummaryView {
  /** Completed rounds. */
  readonly rounds: number;
  /** True when the challenger conceded before the cap — worth stating: it means the claim held. */
  readonly conceded: boolean;
  /** The verdict, or null when no digest could be read — printed as such, never as a guessed verdict. */
  readonly survived: boolean | null;
  /** EXACT Ollama counts for the whole debate; a null metric prints as "not reported", never as 0. */
  readonly promptTokens: number | null;
  readonly evalTokens: number | null;
}
