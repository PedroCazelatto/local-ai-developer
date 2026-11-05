// Part of the Reviewer window's contract with the orchestrator (V2/01).

import type { Message, Tool, ToolCall } from 'ollama';

import type { OllamaClient, StreamHandle } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import type { SandboxClient } from '../container/sandbox.js';
import type { SpawnedMemory } from './spawned-memory.js';

export interface ReviewerDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
  /**
   * This window's trace in memory.db and its summarization failsafe (spawned-memory.ts), built by the
   * caller — which is what knows the title the context should carry.
   */
  readonly memory: SpawnedMemory;
  /**
   * From SessionConfig — SUMMARIZATION_THRESHOLD_RATIO, threaded on to the ToolContext this window
   * builds, so a `debate` it runs can give its own windows the same failsafe.
   */
  readonly summarizationThresholdRatio: number;
}
