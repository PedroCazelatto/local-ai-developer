// SessionOrchestrator — where Foundation's pieces become a working session (ports
// core/session/orchestrator.py). Holds the active Phase, per-phase SessionMemory, the
// OllamaClient (03), the SandboxClient (04), and the exact tokens from the last turn. Drives the
// tool-dispatch turn loop (turn-loop.ts) and exposes the small surface the REPL (05) needs.

import { buildSystemPrompt } from '../../context/index.js';
import { PhaseFactory } from '../../phases/index.js';
import type { Phase } from '../../phases/index.js';
import { READ_FILE_TOOL, readFile } from '../../tools/index.js';
import type { SandboxClient } from '../container/index.js';
import { OllamaClient } from '../llm/index.js';
import type { Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { SessionConfig } from './config.js';
import { SessionMemory } from './memory.js';
import { processMessage as processTurns } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

export class SessionOrchestrator implements TurnContext {
  /** Read-only session facts for the status line (locked for the session's lifetime). */
  readonly project: string;
  readonly model: string;
  readonly numCtx: number;

  private readonly llm: OllamaClient;
  private readonly sandbox: SandboxClient;
  private readonly memory = new SessionMemory();
  private phase: Phase;
  private lastTokens: TokenCounts = NO_TOKENS;

  // Foundation ships ONE tool (read_file) through the dispatch seam; the real registry is V1.
  private readonly tools: Tool[] = [READ_FILE_TOOL];

  constructor(config: SessionConfig, llm: OllamaClient, sandbox: SandboxClient) {
    this.project = config.projectName;
    this.model = config.modelName;
    this.numCtx = config.numCtx;
    this.llm = llm;
    this.sandbox = sandbox;
    this.phase = PhaseFactory.get(config.initialPhase);
    this.memory.setActivePhase(this.phase.name);
  }

  get activePhase(): string {
    return this.phase.name;
  }

  /** Exact token counts from the last turn (propagated as-is; null stays null). */
  get lastTurnTokens(): TokenCounts {
    return this.lastTokens;
  }

  /** Exact combined tokens for the status line, or null if either metric was unreported. */
  get lastTurnTokenTotal(): number | null {
    const { promptTokens, evalTokens } = this.lastTokens;
    if (promptTokens === null || evalTokens === null) {
      return null;
    }
    return promptTokens + evalTokens;
  }

  availablePhases(): string[] {
    return PhaseFactory.availablePhases();
  }

  /** Read-only view of the ACTIVE phase's message history (for debugging / future /resume). */
  get history(): readonly Message[] {
    return this.memory.history;
  }

  /** Switch active phase; loads its instructions and points memory at its own history (no leak). */
  switchPhase(name: string): void {
    this.phase = PhaseFactory.get(name);
    this.memory.setActivePhase(this.phase.name);
  }

  /** Entry point the REPL calls for a chat message: run the bounded tool-dispatch turn loop. */
  async processMessage(userInput: string): Promise<void> {
    await processTurns(this, userInput);
  }

  // ---------------------------------------------------------------- TurnContext seam (turn-loop)

  streamAsk(userInput: string): StreamHandle {
    this.memory.add('user', userInput);
    return this.llm.stream(this.buildMessages(), this.tools);
  }

  streamContinue(): StreamHandle {
    return this.llm.stream(this.buildMessages(), this.tools);
  }

  onTokens(tokens: TokenCounts): void {
    this.lastTokens = tokens;
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    this.memory.add('assistant', content, toolCalls ? { toolCalls } : undefined);
  }

  addToolResult(toolName: string, result: string): void {
    this.memory.add('tool', result, { toolName });
  }

  /**
   * The dispatch seam. Foundation routes the one built-in tool through the sandbox; unknown tools
   * and thrown errors return a structured, recoverable string the model can read and retry from —
   * it never throws up into the turn loop.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    // TODO(V1): append one JSON line per call to .orchestrator/tool_audit.jsonl (audit-log seam).
    try {
      if (name === 'read_file') {
        return await readFile(this.sandbox, args);
      }
      return `Error: unknown tool '${name}'.`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /** System prompt (from the ACTIVE phase's instructions + project state) then that phase's history. */
  private buildMessages(): Message[] {
    const system = buildSystemPrompt(this.phase.instructions, `Project: ${this.project}`);
    return [{ role: 'system', content: system }, ...this.memory.history];
  }
}
