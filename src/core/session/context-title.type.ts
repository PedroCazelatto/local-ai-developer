// Part of the generate-context-title contract.

import type { Message, OllamaClient, TokenCounts } from '../llm/index.js';

/** A title plus the EXACT tokens the throwaway call spent producing it (never estimated). */
export interface ContextTitle {
  readonly title: string;
  readonly tokens: TokenCounts;
}
