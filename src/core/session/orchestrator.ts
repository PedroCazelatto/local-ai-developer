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
import * as renderer from '../ui/renderer.js';
import { appendAuditRow } from './audit.js';
import type { SessionConfig } from './config.js';
import { dispatchToolCall } from './dispatch.js';
import { SessionMemory } from './memory.js';
import { compactActivePhase } from './summarizer.js';
import type { ArchiveSummary, ClearResult } from './memory-store.type.js';
import { SubagentManager, SUBAGENT_TOOL_NAMES } from './subagents.js';
import type { SubagentInfo } from './subagents.type.js';
import { processMessage as processTurns } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import { runTaskLoop } from './run-task-loop.js';
import type { TaskLoopReporter, TaskLoopResult } from './run-task-loop.type.js';
import { spawnRetro as spawnRetroWindow } from './retro-runner.js';
import type { RetroInput, RetroResult } from './retro-runner.type.js';
import type { Task } from './types.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

export class SessionOrchestrator implements TurnContext {
  /** Read-only session facts for the status line (locked for the session's lifetime). */
  readonly project: string;
  readonly numCtx: number;

  /** Host path to projects/<active> — the ToolContext root and the sandbox's /workspace mount. */
  readonly projectPath: string;
  private readonly llm: OllamaClient;
  private readonly sandbox: SandboxClient;
  private readonly memory: SessionMemory;
  private phase: Phase;
  private lastTokens: TokenCounts = NO_TOKENS;

  // Summarization failsafe (V4/05). The trigger point (exact tokens): a phase whose last
  // prompt_eval_count reaches this many tokens is scheduled to compact before its NEXT model call.
  private readonly summarizationThreshold: number;
  // Phases scheduled to compact before their next call. In-RAM only + keyed by phase, so it survives
  // /swap but not a restart (post-restart the first call re-measures and reschedules if still large).
  private readonly scheduledPhases = new Set<string>();
  // The EXACT prompt_eval_count of each phase's most recent call (null when Ollama omitted it).
  private readonly lastPromptTokens = new Map<string, number | null>();

  // The full tool set from the registry (V1/02), sent on every call for every phase — no per-phase
  // gating. Built once; the registry is static. Includes the three sub-agent tools (V5/01).
  private readonly tools: Tool[] = toolDefinitions();

  // The tool set handed to spawned EXECUTION windows (Worker/Reviewer/Retro): `tools` minus the three
  // sub-agent tools, since those windows have no SubagentManager to back them. Interactive phases still
  // get the full `tools`. Built once (the registry is static).
  private readonly executionTools: Tool[] = this.tools.filter(
    (tool) => !SUBAGENT_TOOL_NAMES.includes(tool.function.name ?? ''),
  );

  // Sub-agents (V5/01) the interactive phases spawn mid-turn: in-memory only, dropped at session end.
  // Exposed to the sub-agent tools via ctx.subagents, to `/subagents`, and to the status-line count.
  private readonly subagents: SubagentManager;

  constructor(config: SessionConfig, llm: OllamaClient, sandbox: SandboxClient) {
    this.project = config.projectName;
    this.projectPath = config.projectPath;
    this.numCtx = config.numCtx;
    // Exact token ceiling for the failsafe: ratio × num_ctx. Compared against the EXACT
    // prompt_eval_count (never a length estimate — constitution) to schedule a compaction.
    this.summarizationThreshold = config.summarizationThresholdRatio * config.numCtx;
    this.llm = llm;
    this.sandbox = sandbox;
    this.memory = new SessionMemory(config.projectPath); // JSONL-backed, under the project's .orchestrator/
    this.phase = PhaseFactory.get(config.initialPhase);
    // activatePhase LAZILY loads this phase's `<phase>.jsonl` — so a restart resumes where it stopped.
    this.memory.activatePhase(this.phase.name);
    // The manager gets the FULL tool set and filters the three sub-agent tools out of each sub-agent's
    // own defs (no nesting). num_ctx is the session's; the live model is read from `llm` at spawn (V5/02 —
    // every window shares the one live model, which only ever changes between turns).
    this.subagents = new SubagentManager({
      llm: this.llm,
      tools: this.tools,
      sandbox: this.sandbox,
      projectName: this.project,
      projectPath: this.projectPath,
      numCtx: this.numCtx,
    });
  }

  /** Live session model (V5/02) — the status line reads this; `/models use` changes it via useModel. */
  get model(): string {
    return this.llm.model;
  }

  /**
   * Apply `/models use` (V5/02): switch the live model on the one shared client. Every subsequent turn —
   * the active phase, and any newly spawned Worker/Reviewer/Retro window or sub-agent — runs against it;
   * the status line reflects it on the next prompt (it reads `model`). Session-local; the command persists
   * the choice to state.json so the next `run start` defaults to it. Callable only between turns (the REPL
   * is blocked during any turn/batch), so nothing in flight ever changes model mid-work.
   */
  useModel(name: string): void {
    this.llm.setModel(name);
  }

  /** Count of live sub-agents (V5/01) — the status line's `Subagents: N`, omitted when zero. */
  get subagentCount(): number {
    return this.subagents.count;
  }

  /** Snapshot of every live sub-agent for the `/subagents` command (id, age, messages, exact tokens). */
  listSubagents(): SubagentInfo[] {
    return this.subagents.list();
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

  /** Switch active phase; loads its instructions and (lazily, from disk) its own history (no leak). */
  switchPhase(name: string): void {
    this.phase = PhaseFactory.get(name);
    this.memory.activatePhase(this.phase.name);
  }

  /** `/clear` (V4/04): archive the active phase's history, reset it in-RAM. Other phases untouched. */
  clearActivePhase(): ClearResult {
    return this.memory.clearActive();
  }

  /** `/resume` listing: the last `limit` archives for the active phase (summaries from JSONL, no LLM). */
  activePhaseArchives(limit: number): ArchiveSummary[] {
    return this.memory.archivesForActive(limit);
  }

  /** `/resume` restore: swap a chosen archive back into the active file and reload it into RAM. */
  resumeActivePhaseArchive(basename: string): void {
    this.memory.restoreActive(basename);
  }

  /** Entry point the REPL calls for a chat message: run the bounded tool-dispatch turn loop. */
  async processMessage(userInput: string): Promise<void> {
    await processTurns(this, userInput);
  }

  /**
   * Run the bounded implement→test→review→fix loop (V3/01) for one backlog task: a persistent Worker
   * window across rounds, a FRESH Reviewer each round, auto-commit on a `pass`, escalate after the
   * hard cap of 5 rounds. Windows are isolated from every phase history and from each other. This
   * just binds the session's infra deps; the caller supplies the reporter (UI is injected, not
   * hard-wired). Never touches the active phase's history.
   */
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult> {
    return runTaskLoop(
      {
        llm: this.llm,
        tools: this.executionTools, // spawned windows don't get the sub-agent tools (no manager backs them)
        sandbox: this.sandbox,
        projectName: this.project,
        projectPath: this.projectPath,
      },
      task,
      specSlice,
      reporter,
    );
  }

  /**
   * Spawn the one-shot Retro window (V3/03) after the user resolves a blocker: a fresh, isolated window
   * that diagnoses the misunderstanding and patches EXACTLY ONE file — a systemic gap edits a global
   * rules/phases file (left UNCOMMITTED + a review warning), a task-specific gap edits the project doc
   * (committed via V2/03). Binds the session infra; the caller (/answer) renders the RetroResult and
   * surfaces any systemic review-warning. Never touches the active phase's history. Throws RetroError if
   * the Retro produced no edit / never submitted (best-effort learning — the caller keeps going).
   */
  spawnRetro(input: RetroInput): Promise<RetroResult> {
    return spawnRetroWindow(
      {
        llm: this.llm,
        tools: this.executionTools, // spawned windows don't get the sub-agent tools (no manager backs them)
        sandbox: this.sandbox,
        projectName: this.project,
        projectPath: this.projectPath,
      },
      input,
    );
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
    // Failsafe trigger (V4/05): remember this phase's EXACT last prompt size and, if it reached the
    // threshold, schedule a compaction to run BEFORE this phase's next model call. A null count
    // (Ollama omitted the metric) can't ground a VRAM decision — never estimate, so never schedule.
    const phase = this.phase.name;
    this.lastPromptTokens.set(phase, tokens.promptTokens);
    if (tokens.promptTokens !== null && tokens.promptTokens >= this.summarizationThreshold) {
      this.scheduledPhases.add(phase);
    }
  }

  /**
   * Failsafe hook (V4/05), awaited by the turn loop before EACH model call. If this phase was
   * scheduled (its last prompt_eval_count reached SUMMARIZATION_THRESHOLD_RATIO × num_ctx), compact
   * its oldest ~50% of visible turns into a `summary` record via a throwaway call — synchronously, in
   * this single-threaded loop (no parallelism, CLAUDE.md) — so the imminent call runs on the shrunken
   * history. Cleared once per trip; if the next call is still large, onTokens simply reschedules.
   */
  async beforeModelCall(): Promise<void> {
    const phase = this.phase.name;
    if (!this.scheduledPhases.has(phase)) return;
    this.scheduledPhases.delete(phase);
    // The one user-visible status line the task specifies.
    renderer.systemMessage(`Compacting ${titleCase(phase)} history (failsafe)...`);
    // compactActivePhase: collapse the active phase's oldest ~50% visible turns into one `summary`
    // record (throwaway oneShot; append-only on disk; the in-RAM view collapses). Exact tokens only.
    await compactActivePhase({ llm: this.llm, memory: this.memory });
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    // Persist the EXACT counts Ollama just reported for THIS turn (set by onTokens immediately prior
    // in the turn loop): prompt_eval_count→prompt, eval_count→completion. Never estimated.
    const tokens = { prompt: this.lastTokens.promptTokens, completion: this.lastTokens.evalTokens };
    this.memory.add('assistant', content, toolCalls ? { toolCalls, tokens } : { tokens });
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
      llm: this.llm, // backs ctx.oneShot for search_rules (V4/02)
      subagents: this.subagents, // ONLY the interactive master phases can spawn sub-agents (V5/01)
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

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
