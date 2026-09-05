// Part of the summarizer contract.

import type { Message, OllamaClient, TokenCounts } from '../llm/index.js';
import type { SessionMemory } from './session-memory.js';

export interface CompactDeps {
  readonly llm: OllamaClient;
  readonly memory: SessionMemory;
}
