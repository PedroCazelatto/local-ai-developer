// EXACT token counts as Ollama reported them. The constitution's hardest correctness invariant lives
// in this shape: counts are read from prompt_eval_count / eval_count and propagated unchanged to every
// consumer -- status line, summarization trigger, audit log, /resume summaries -- and NEVER estimated
// from a length. Estimates drift, and a drifting count is the wrong basis for a VRAM-safety decision.
//
// Its own module because no function owns it: OllamaClient reports it, oneShot reports it, and a dozen
// files across core/session read it. It is the vocabulary of a metric, not the private shape of a call.

/**
 * EXACT token counts from Ollama — never estimated. `null` means Ollama did not report the
 * metric on this call; the distinction between "0 tokens" and "not reported" is preserved
 * (never coerce null → 0). The whole VRAM-safety model depends on these being exact.
 */
export interface TokenCounts {
  readonly promptTokens: number | null; // exact prompt_eval_count; null if omitted
  readonly evalTokens: number | null; // exact eval_count; null if omitted
}
