// Part of the summarizer contract.

import type { Message } from 'ollama';

import type { OllamaClient } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';

/**
 * Outcome of one compaction: how many turns collapsed + the throwaway call's EXACT tokens (for the
 * caller to log if it wishes). `null` when there was nothing to compact (fewer than two visible
 * turns) — which should not happen once the threshold has actually tripped.
 */
export interface CompactResult {
  readonly replaced: number;
  readonly tokens: TokenCounts;
}
