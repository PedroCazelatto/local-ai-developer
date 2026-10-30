// Part of the generate-context-title contract.

import type { Message } from 'ollama';

import type { OllamaClient } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';

/** A title plus the EXACT tokens the throwaway call spent producing it (never estimated). */
export interface ContextTitle {
  readonly title: string;
  readonly tokens: TokenCounts;
}
