// The EXACT Ollama counts for one turn. `null` means the metric was genuinely ABSENT, never estimated:
// the difference between "0 tokens" and "Ollama reported none" is the whole basis of the exact-token
// invariant (constitution), so nothing here may coerce a null to a zero.

/** EXACT Ollama counts for one turn — `null` means the metric was genuinely absent, never estimated. */
export interface TurnTokens {
  readonly prompt: number | null;
  readonly completion: number | null;
}
