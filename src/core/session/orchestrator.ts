// SessionOrchestrator — where Foundation's pieces become a working session (ports
// core/session/orchestrator.py). Holds the active Phase, per-phase SessionMemory, the
// OllamaClient (03), the SandboxClient (04), and the exact tokens from the last turn. Drives the
// tool-dispatch turn loop (turn-loop.ts) and exposes the small surface the REPL (05) needs.

import { buildSystemPrompt } from '../../context/index.js';
import { PhaseFactory } from '../../phases/index.js';
import type { Phase } from '../../phases/index.js';
import { createToolContext, toolDefinitions } from '../../tools/index.js';
import type { SandboxClient } from '../container/index.js';
import { OllamaClient } from '../llm/index.js';
import type { Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import { appendAuditRow } from './audit.js';
import type { SessionConfig } from './config.js';
import { dispatchToolCall } from './dispatch.js';
import { SessionMemory } from './memory.js';
import { processMessage as processTurns } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import type { ReviewerInput, ReviewerOutcome } from './reviewer-runner.js';
import { runReviewerTask } from './reviewer-runner.js';
import type { Task } from './types.js';
import { runWorkerTask } from './worker-runner.js';
import type { WorkerResult } from './worker-runner.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

export class SessionOrchestrator implements TurnContext {
  /** Read-only session facts for the status line (locked for the session's lifetime). */
  readonly project: string;
  readonly model: string;
  readonly numCtx: number;

  /** Host path to projects/<active> — the ToolContext root and the sandbox's /workspace mount. */
  readonly projectPath: string;
  private readonly llm: OllamaClient;
  private readonly sandbox: SandboxClient;
  private readonly memory = new SessionMemory();
  private phase: Phase;
  private lastTokens: TokenCounts = NO_TOKENS;

  // The full tool set from the registry (V1/02), sent on every call for every phase — no per-phase
  // gating. Built once; the registry is static.
  private readonly tools: Tool[] = toolDefinitions();

  constructor(config: SessionConfig, llm: OllamaClient, sandbox: SandboxClient) {
    this.project = config.projectName;
    this.projectPath = config.projectPath;
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

  /**
   * Spawn a FRESH, isolated Worker window for one backlog task (V1/10) and return its result. The
   * window never touches the active phase's history; its tool calls are audited as phase "worker".
   */
  runWorkerTask(task: Task, specSlice: string): Promise<WorkerResult> {
    return runWorkerTask(
      {
        llm: this.llm,
        tools: this.tools,
        sandbox: this.sandbox,
        projectName: this.project,
        projectPath: this.projectPath,
      },
      task,
      specSlice,
    );
  }

  /**
   * Spawn a FRESH, isolated Reviewer window (V2/01) to judge one Worker attempt and return its
   * validated verdict + exact tokens. Isolated from every phase history and from the Worker's, so it
   * judges independently. Surfaces the Reviewer's exact token usage to the status line (never
   * estimated). Throws ReviewerVerdictError if the Reviewer produced no usable verdict.
   */
  async runReviewerTask(input: ReviewerInput): Promise<ReviewerOutcome> {
    const outcome = await runReviewerTask(
      {
        llm: this.llm,
        tools: this.tools,
        sandbox: this.sandbox,
        projectName: this.project,
        projectPath: this.projectPath,
      },
      input,
    );
    this.lastTokens = outcome.tokens;
    return outcome;
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
   * The dispatch seam (V1/02). Builds a ToolContext bound to the active project + CURRENT phase and
   * runs the call through the registry-backed dispatcher, which validates args, executes the tool,
   * and returns a structured recoverable string on any bad/unknown call — never throwing up into
   * the turn loop. The audit sink (V1/06) hooks here via the dispatch `onToolCall` seam.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const ctx = createToolContext({
      projectName: this.project,
      projectPath: this.projectPath,
      sandbox: this.sandbox,
      phase: this.phase.name,
    });
    // Every dispatched call — success, failure, or sub-step — is appended to the audit log (V1/06).
    return dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => appendAuditRow(this.projectPath, record),
    });
  }

  /** System prompt (from the ACTIVE phase's instructions + project state) then that phase's history. */
  private buildMessages(): Message[] {
    const system = buildSystemPrompt(this.phase.instructions, `Project: ${this.project}`);
    return [{ role: 'system', content: system }, ...this.memory.history];
  }
}
