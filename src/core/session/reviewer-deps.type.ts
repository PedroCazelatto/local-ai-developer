// Part of the Reviewer window's contract with the orchestrator (V2/01).

import type { Message, Tool, ToolCall } from 'ollama';

import type { OllamaClient, StreamHandle } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import type { SandboxClient } from '../container/sandbox.js';

export interface ReviewerDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
}
