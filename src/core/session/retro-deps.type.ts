// The session infrastructure a Retro window binds to, supplied by the orchestrator.

import type { OllamaClient } from '../llm/client.js';
import type { SandboxClient } from '../container/sandbox.js';
import type { SpawnedMemory } from './spawned-memory.js';

/** The session infrastructure the Retro window binds to (supplied by the orchestrator). */
export interface RetroDeps {
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
