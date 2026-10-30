// The most recent EXACT prompt_eval_count in a run of records — the restored context size after a
// reopen. NEVER estimated: a run that recorded no metric answers null, and the caller surfaces that
// rather than substituting a length-based guess (constitution: token counts are always exact).
//
// Named lastPromptTokens rather than the module-private `lastPromptTokensOf` it was extracted from.

import type { MemoryRecord } from './memory-record.type.js';

/** The most recent EXACT prompt_eval_count among the records, or null if none recorded one. */
export function lastPromptTokens(records: readonly MemoryRecord[]): number | null {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const prompt = records[i]?.tokens.prompt;
    if (typeof prompt === 'number') return prompt;
  }
  return null;
}
