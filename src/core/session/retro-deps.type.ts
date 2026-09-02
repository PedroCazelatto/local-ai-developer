// The session infrastructure a Retro window binds to, supplied by the orchestrator.

import type { OllamaClient } from '../llm/client.js';
import type { SandboxClient } from '../container/sandbox.js';

/** The session infrastructure the Retro window binds to (supplied by the orchestrator). */
export interface RetroDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
}
