// Part of the Worker window's contract with the orchestrator (V2/01).

import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { SandboxClient } from '../container/index.js';

export interface WorkerDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
  /**
   * From SessionConfig — the fraction of the base context ceiling at which this window starts stubbing
   * its older tool results. Threaded, unlike the ceiling itself (which is read off `llm.baseNumCtx`,
   * since the client is what puts it on the wire), because config is what owns a tuning ratio and boot
   * is where it is resolved.
   */
  readonly evictionThresholdRatio: number;
}
