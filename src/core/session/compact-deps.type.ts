// Part of the summarizer contract.

import type { Message } from 'ollama';

import type { OllamaClient } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import type { SessionMemory } from './session-memory.js';

export interface CompactDeps {
  readonly llm: OllamaClient;
  readonly memory: SessionMemory;
}
