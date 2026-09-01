// Part of the Reviewer window's contract with the orchestrator (V2/01).

import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { SandboxClient } from '../container/index.js';

export interface ReviewerDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
}
