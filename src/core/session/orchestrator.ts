// SessionOrchestrator — where Foundation's pieces become a working session (ports
// core/session/orchestrator.py). Holds the active Phase, per-phase SessionMemory, the
// OllamaClient (03), the SandboxClient (04), and the exact tokens from the last turn. Drives the
// tool-dispatch turn loop (turn-loop.ts) and exposes the small surface the REPL (05) needs.

import { buildSystemPrompt } from '../../context/index.js';
import type { Phase } from '../../phases/index.js';
import { PhaseFactory, resolvePhaseTools } from '../../phases/index.js';
import { createToolContext } from '../../tools/index.js';
import type { SandboxClient } from '../container/index.js';
import type { Message, StreamHandle, TokenCounts, Tool, ToolCall, TurnAbortReason } from '../llm/index.js';
import { OllamaClient } from '../llm/index.js';
import { renderer } from '../ui/renderer.js';
import { addTokenCounts } from './add-token-counts.js';
import type { SessionConfig } from './config.js';
import { dispatchToolCall } from './dispatch.js';
import { drainAnsweredQuestions } from './drain-answered-questions.js';
import { appendEvent } from './events-log.js';
import { generateContextTitle } from './generate-context-title.js';
import type { ClearResult, ContextSummary, PhaseLoad } from './memory-db.type.js';
import { SessionMemory } from './memory.js';
import { createReadTracker } from './read-tracker.js';
import type { FileReadTracker } from './read-tracker.type.js';
import { recordToolCall } from './record-tool-call.js';
import { spawnRetro as spawnRetroWindow } from './retro-runner.js';
import type { RetroInput, RetroResult } from './retro-runner.type.js';
import { RunStopSignal } from './run-stop-signal.js';
import { runTaskLoop } from './run-task-loop.js';
import type { TaskLoopReporter, TaskLoopResult } from './run-task-loop.type.js';
import { SubagentManager } from './subagents.js';
import type { SubagentInfo } from './subagents.type.js';
import { compactActivePhase } from './summarizer.js';
import type { Task } from './task.type.js';
import type { TurnContext } from './turn-loop.js';
import { processMessage as processTurns } from './turn-loop.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

export class SessionOrchestrator implements TurnContext {
  /** Read-only session facts for the status line (locked for the session's lifetime). */
  readonly project: string;
  /**
   * The ceiling this phase's turns are actually sent under — `config.numCtx`, i.e. OLLAMA_NUM_CTX
   * unchanged. It survived per-window `num_ctx` untouched, and that is by CONSTRUCTION rather than
   * coincidence: 'interactive' is a WINDOW role, and resolve-window-ctx.ts gives every window role the
   * base by holding no table entry for it. There is no number to keep in step with, because there is no
   * second number.
   *
   * That matters because of what reads this: the status line's `Ctx:` denominator, the summarization
   * threshold below, and — through SessionMemory — the value stamped on every phase context and used to
   * filter every `/resume` listing. A value derived per window reaching that last one would hide every
   * context in every project. If a future change ever gives the interactive phases a ceiling of their
   * own, this field is what must follow it, and memory.ts must NOT.
   */
  readonly numCtx: number;

  /** Host path to projects/<active> — the ToolContext root and the sandbox's /workspace mount. */
  readonly projectPath: string;
  private readonly llm: OllamaClient;
  private readonly sandbox: SandboxClient;
  private readonly memory: SessionMemory;
  private phase: Phase;
  private lastTokens: TokenCounts = NO_TOKENS;
  /** Handed to each spawned Worker window; see run-task-loop.type.ts and worker-runner.ts. */
  private readonly evictionThresholdRatio: number;

  // Summarization failsafe (V4/05). The trigger point (exact tokens): a phase whose last
  // prompt_eval_count reaches this many tokens is scheduled to compact before its NEXT model call.
  private readonly summarizationThreshold: number;
  // Phases scheduled to compact before their next call. In-RAM only + keyed by phase, so it survives
  // /swap but not a restart (post-restart the first call re-measures and reschedules if still large).
  private readonly scheduledPhases = new Set<string>();
  // The EXACT prompt_eval_count of each phase's most recent call (null when Ollama omitted it).
  private readonly lastPromptTokens = new Map<string, number | null>();

  // Cost visibility (V5/04): the EXACT cumulative token total per phase, folded from each turn's
  // prompt_eval_count / eval_count via addTokenCounts (a null on any turn POISONS the sum to null,
  // so a missing count is surfaced as incomplete — never estimated). Surfaced on the status line.
  private readonly phaseTokens = new Map<string, TokenCounts>();

  // Summarization events (V5/04) are DEFERRED: when beforeModelCall compacts a phase, we can't yet
  // know the post-compaction prompt size — that arrives on the NEXT call's onTokens. This maps a phase
  // to its pre-compaction EXACT prompt count ("before"); onTokens emits summarization_fire with the
  // next call's exact prompt count as "after", then clears the entry.
  private readonly pendingSummarization = new Map<string, number | null>();

  // What each master phase has READ, so write_file/edit_file can refuse a file the window has not seen
  // or has seen a stale copy of (tools/guard-write-target.ts). Keyed by phase because each phase is its
  // own window onto its own context; `/swap` moves between them and must not empty either. `/clear` and
  // `/resume` DO empty the active phase's entry — they change which context the phase is on, and the
  // tracker follows the context. The spawned windows (Worker/Reviewer/Retro) and each sub-agent own
  // theirs instead, which is what stops a sub-agent's reads satisfying its parent's guard.
  private readonly readTrackers = new Map<string, FileReadTracker>();

  // Sub-agents (V5/01) the interactive phases spawn mid-turn: in-memory only, dropped at session end.
  // Exposed to the sub-agent tools via ctx.subagents, to `/subagents`, and to the status-line count.
  private readonly subagents: SubagentManager;

  // The `/stop` wind-down request for whatever /run is in flight. One per session, handed to every task
  // loop and batch, armed by the input fence's control line and cleared when the run ends — so a stop
  // asked for during last night's batch can never silently apply to this morning's.
  readonly runStop = new RunStopSignal();

  // Where the ACTIVE phase's current exchange began (the seq its user message took). Captured in
  // streamAsk rather than at the top of the turn loop on purpose: beforeModelCall may add a user message
  // of its own just before it — the answers drained from `/questions` — and those are delivered exactly
  // once, so a cancel must branch off the exchange WITHOUT taking them down with it.
  private exchangeStartSeq: number | null = null;

  constructor(config: SessionConfig, llm: OllamaClient, sandbox: SandboxClient) {
    this.project = config.projectName;
    this.projectPath = config.projectPath;
    this.numCtx = config.numCtx;
    // Exact token ceiling for the failsafe: ratio × num_ctx. Compared against the EXACT
    // prompt_eval_count (never a length estimate — constitution) to schedule a compaction.
    this.summarizationThreshold = config.summarizationThresholdRatio * config.numCtx;
    // Kept as the RATIO, not a threshold: it belongs to the spawned Worker window, which resolves it
    // against the client's own num_ctx when it is created (worker-runner.ts).
    this.evictionThresholdRatio = config.evictionThresholdRatio;
    this.llm = llm;
    this.sandbox = sandbox;
    // SQLite-backed (memory.db under the project's .orchestrator/). numCtx is stamped on every context
    // this session creates and is the ceiling every listing filters against, with `<=` rather than `=`:
    // a context written under a SMALLER ceiling is listed and reopenable (its history fits this window),
    // while one written under a LARGER ceiling is hidden rather than replayed into a window that would
    // silently drop its oldest tokens.
    this.memory = new SessionMemory(config.projectPath, config.numCtx);
    this.phase = PhaseFactory.get(config.initialPhase);
    // Every boot starts a phase on a FRESH context (docs/mental-model.md): activatePhase reads nothing
    // from disk, and the context row itself is created lazily on the first flush. An older context is
    // reached only when the user reopens one — which is what emits a memory_load.
    this.memory.activatePhase(this.phase.name);
    // The manager resolves each sub-agent's tools from ITS MASTER PHASE's allowlist at spawn (minus the
    // three sub-agent tools, so no nesting) — a sub-agent never gets the full registry, which would be a
    // way around its master's gate. num_ctx is the session's; the live model is read from `llm` at spawn
    // (V5/02 — every window shares the one live model, which only ever changes between turns).
    this.subagents = new SubagentManager({
      llm: this.llm,
      sandbox: this.sandbox,
      projectName: this.project,
      projectPath: this.projectPath,
      numCtx: this.numCtx,
    });
  }

  /**
   * Live session model (V5/02), or undefined when none is selected — the status line reads this and
   * renders the empty case. Undefined is reachable only on a machine with no models installed where the
   * user declined the boot download (resolve-boot-model.ts); a turn then fails with an actionable line.
   */
  get model(): string | undefined {
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
    const from = this.llm.model;
    this.llm.setModel(name);
    // V5/04 model_use: only a real switch is worth a row (a no-op `/models use <current>` is dropped
    // earlier by the command, but guard here too). `from` is OMITTED when the session had no model to
    // switch away from — this file's own convention for a genuinely-absent value, never invented as "".
    if (from !== name) {
      appendEvent(this.projectPath, {
        type: 'model_use',
        phase: this.phase.name,
        detail: { ...(from !== undefined && { from }), to: name },
      });
    }
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

  /**
   * Cost visibility (V5/04): the ACTIVE phase's EXACT cumulative token total (prompt + eval summed
   * across every turn), for the status line's `Σ` field. `0` before the phase has taken any turn;
   * `null` when some turn's count was unreported (surfaced as incomplete, never estimated).
   */
  get activePhaseTokenTotal(): number | null {
    const total = this.phaseTokens.get(this.phase.name);
    if (total === undefined) return 0;
    if (total.promptTokens === null || total.evalTokens === null) return null;
    return total.promptTokens + total.evalTokens;
  }

  availablePhases(): string[] {
    return PhaseFactory.availablePhases();
  }

  /** Read-only view of the ACTIVE phase's message history (for debugging / future /resume). */
  get history(): readonly Message[] {
    return this.memory.history;
  }

  /**
   * The active phase's read tracker, created on first use. Lazily rather than per phase up front so a
   * phase the session never visits never holds one, and so `/clear` can simply drop the entry.
   */
  private trackerForActivePhase(): FileReadTracker {
    const existing = this.readTrackers.get(this.phase.name);
    if (existing !== undefined) return existing;
    // createReadTracker: an empty per-window map of path → hash of the bytes the window read.
    const created = createReadTracker();
    this.readTrackers.set(this.phase.name, created);
    return created;
  }

  /** Switch active phase; loads its instructions and points at its own history (no leak, no disk read). */
  switchPhase(name: string): void {
    const from = this.phase.name;
    this.phase = PhaseFactory.get(name);
    this.memory.activatePhase(this.phase.name);
    // V5/04 phase_swap (covers /swap AND the Shift+Tab cycle — both route through here); skip a no-op
    // swap to the same phase. `phase` is the now-active phase; `detail` carries both ends.
    if (from !== this.phase.name) {
      appendEvent(this.projectPath, {
        type: 'phase_swap',
        phase: this.phase.name,
        detail: { from, to: this.phase.name },
      });
    }
  }

  /**
   * Emit a V5/04 `memory_load` event for a REOPENED context — the one path that restores persisted turns
   * now that every boot starts a phase fresh. Carries the context, turnsLoaded, and the EXACT restored
   * prompt_eval_count when one was recorded (omitted, never estimated, when it was not).
   */
  private emitMemoryLoad(load: PhaseLoad): void {
    if (load.turns === 0) return;
    appendEvent(this.projectPath, {
      type: 'memory_load',
      phase: this.phase.name,
      detail: { phase: this.phase.name, contextId: load.contextId, turnsLoaded: load.turns },
      ...(load.lastPromptTokens !== null ? { promptTokens: load.lastPromptTokens } : {}),
    });
  }

  /**
   * `/clear`: start the active phase on a NEW context. Nothing is destroyed — the context it sets aside
   * keeps every turn and stays reopenable, and the returned ClearResult names it so the command can say
   * what `/resume` would bring back. Other phases are untouched.
   */
  clearActivePhase(): ClearResult {
    // The read tracker follows the phase CONTEXT, not the process: the context being set aside is where
    // those reads live, and the new one carries no history of them. A guard that still honoured them
    // would be answering for a window the model can no longer see.
    this.readTrackers.delete(this.phase.name);
    return this.memory.clearActive();
  }

  /** `/resume` listing: the active phase's last `limit` contexts, most recently active first (no LLM). */
  activePhaseContexts(limit: number): ContextSummary[] {
    return this.memory.contextsForActive(limit);
  }

  /**
   * `/resume` reopen: replay a chosen context's visible turns into the active phase, addressed by its
   * UUID or a unique prefix. Returns null when the address matches no single context of this phase, so
   * the command reports a recoverable line instead of acting on a guess.
   *
   * On success it hands back the reopened context's listing row rather than a bare `true`, because
   * `/resume <address>` never went through the listing and still has to tell the user when the history
   * it just restored was written under a smaller `num_ctx` than this session runs.
   */
  reopenActiveContext(address: string): ContextSummary | null {
    const load = this.memory.reopenActiveContext(address);
    if (load === null) return null;
    // Same rule as `/clear`: a different context is a different window's worth of reads. Dropped only
    // once the reopen has actually succeeded — a failed address changes nothing.
    this.readTrackers.delete(this.phase.name);
    this.emitMemoryLoad(load);
    return load.summary;
  }

  /**
   * End the session cleanly: commit anything any phase left buffered and close memory.db, so SQLite
   * checkpoints its write-ahead log instead of leaving sidecar files for the next boot to recover.
   * Called once, after the REPL loop returns.
   */
  shutdown(): void {
    this.memory.close();
  }

  /**
   * Entry point the REPL calls for a chat message: run the bounded tool-dispatch turn loop, then title
   * the context if this exchange produced its first prose answer.
   */
  async processMessage(userInput: string): Promise<void> {
    await processTurns(this, userInput);
    await this.titleActiveContext();
  }

  /**
   * Give the active phase's context its title, once, after its first prose answer. Runs AFTER the turn
   * loop rather than inside it: the title costs a throwaway model call, and holding it until the
   * exchange is finished keeps it off the path between the user's message and the reply.
   *
   * Best-effort by design — a context stays untitled rather than failing a turn the user already had.
   * The attempt is marked before the call, so a model that cannot produce a usable title is not asked
   * again every exchange for the rest of the session.
   */
  private async titleActiveContext(): Promise<void> {
    if (!this.memory.activeNeedsTitle()) return;
    this.memory.markActiveTitleAttempted();
    const contextId = this.memory.activeContextId;
    if (contextId === null) return;
    try {
      // generateContextTitle: a throwaway one-shot (rules/prompts/context-title.md + this context's
      // history) returning one line of at most CONTEXT_TITLE_LIMIT chars, or null if nothing usable.
      const titled = await generateContextTitle(this.llm, this.memory.activeVisibleRecords());
      if (titled === null) return;
      this.memory.setActiveTitle(titled.title);
      // The throwaway call belongs to no phase's history, so this log is the only place its EXACT cost is
      // surfaced (a null count is OMITTED rather than guessed — constitution).
      appendEvent(this.projectPath, {
        type: 'context_title',
        phase: this.phase.name,
        detail: { contextId, title: titled.title },
        ...(titled.tokens.promptTokens !== null ? { promptTokens: titled.tokens.promptTokens } : {}),
        ...(titled.tokens.evalTokens !== null ? { evalTokens: titled.tokens.evalTokens } : {}),
      });
    } catch (err) {
      renderer.systemMessage(`Couldn't title this context: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Run the bounded implement→test→review→fix loop (V3/01) for one backlog task: a persistent Worker
   * window across rounds, a FRESH Reviewer each round which commits what it accepts, escalate after the
   * hard cap of 5 rounds. Windows are isolated from every phase history and from each other. This
   * just binds the session's infra deps; the caller supplies the reporter (UI is injected, not
   * hard-wired). Never touches the active phase's history.
   */
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult> {
    return runTaskLoop(
      {
        llm: this.llm,
        sandbox: this.sandbox,
        projectName: this.project,
        projectPath: this.projectPath,
        evictionThresholdRatio: this.evictionThresholdRatio,
        // The session's one wind-down request: the loop reads it between rounds, so `/stop round` lands
        // on the round boundary rather than tearing down the round already running.
        stop: this.runStop,
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
        sandbox: this.sandbox,
        projectName: this.project,
        projectPath: this.projectPath,
      },
      input,
    );
  }

  // ---------------------------------------------------------------- TurnContext seam (turn-loop)

  streamAsk(userInput: string): StreamHandle {
    // Snapshot BEFORE the user message is added: this seq is what a cancel branches the history back to,
    // so it must name the user's own turn and nothing earlier (see the field).
    this.exchangeStartSeq = this.memory.activeNextSeq;
    this.memory.add('user', userInput);
    // 'interactive' is the role every planning-phase turn plays; it resolves to the base ceiling, which
    // is what makes `this.numCtx` below a true statement about these calls (see the field).
    return this.llm.stream('interactive', this.buildMessages(), this.activeTools());
  }

  streamContinue(): StreamHandle {
    return this.llm.stream('interactive', this.buildMessages(), this.activeTools());
  }

  /**
   * The active phase's tool definitions (phase-tool-names.ts). Resolved per call rather than cached:
   * /swap changes the phase between turns, and the resolve is a filter over ~18 static entries.
   * `registryOnly` because this path dispatches through the shared dispatcher (dispatch.ts → getTool),
   * which cannot serve a phase-scoped tool — so swapping the active phase to reviewer/retro offers
   * their registry tools and withholds submit_verdict/submit_retro, which only their own spawned
   * windows can answer.
   */
  private activeTools(): Tool[] {
    return resolvePhaseTools(this.phase.name, { registryOnly: true });
  }

  onTokens(tokens: TokenCounts): void {
    this.lastTokens = tokens;
    const phase = this.phase.name;
    // Cost visibility (V5/04): fold this turn's EXACT counts into the phase's running total (a null
    // poisons the sum to null, surfaced as incomplete on the status line — never a 0-coerced guess).
    const prior = this.phaseTokens.get(phase) ?? { promptTokens: 0, evalTokens: 0 };
    this.phaseTokens.set(phase, addTokenCounts(prior, tokens));
    // If a compaction fired for this phase before THIS call, this call's prompt_eval_count is the exact
    // post-compaction "after" — pair it with the stored "before" and emit the deferred summarization_fire.
    if (this.pendingSummarization.has(phase)) {
      const before = this.pendingSummarization.get(phase) ?? null;
      this.pendingSummarization.delete(phase);
      this.emitSummarizationFire(phase, before, tokens.promptTokens);
    }
    // Failsafe trigger (V4/05): remember this phase's EXACT last prompt size and, if it reached the
    // threshold, schedule a compaction to run BEFORE this phase's next model call. A null count
    // (Ollama omitted the metric) can't ground a VRAM decision — never estimate, so never schedule.
    this.lastPromptTokens.set(phase, tokens.promptTokens);
    if (tokens.promptTokens !== null && tokens.promptTokens >= this.summarizationThreshold) {
      this.scheduledPhases.add(phase);
    }
  }

  /**
   * Emit a V5/04 `summarization_fire` with EXACT before/after prompt-token counts. Either count may be
   * null (Ollama omitted it) — a null is OMITTED from `detail` and flagged `incomplete: true` rather
   * than estimated (constitution: surface a missing metric, never guess).
   */
  private emitSummarizationFire(phase: string, before: number | null, after: number | null): void {
    const detail: Record<string, string | number | boolean> = {};
    if (before !== null) detail['before'] = before;
    if (after !== null) detail['after'] = after;
    if (before === null || after === null) detail['incomplete'] = true;
    appendEvent(this.projectPath, { type: 'summarization_fire', phase, detail });
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
    this.deliverAnsweredQuestions(phase);
    if (!this.scheduledPhases.has(phase)) return;
    this.scheduledPhases.delete(phase);
    // The EXACT prompt size that tripped the failsafe — the "before" for the V5/04 summarization_fire.
    const before = this.lastPromptTokens.get(phase) ?? null;
    // The one user-visible status line the task specifies.
    renderer.systemMessage(`Compacting ${titleCase(phase)} history (failsafe)...`);
    // compactActivePhase: collapse the active phase's oldest ~50% visible turns into one `summary`
    // record (throwaway oneShot; append-only on disk; the in-RAM view collapses). Exact tokens only.
    const result = await compactActivePhase({ llm: this.llm, memory: this.memory });
    // Only a real compaction earns an event: defer it to the next call's onTokens, which supplies the
    // exact post-compaction "after" prompt count. Nothing-to-compact (null) emits nothing.
    if (result !== null) {
      this.pendingSummarization.set(phase, before);
    }
  }

  /**
   * Hand this phase any answers the user gave via `/questions` since its last call (V6/01), as one
   * user message added just before the model sees the history. Questions the user skipped during an
   * ask_user round are durable, so the answer usually arrives turns later — possibly after a phase
   * swap or a restart — and this is where it rejoins the window that asked.
   *
   * drainAnsweredQuestions marks each answer delivered as it hands it over, so it is injected exactly
   * once: replaying it every call would re-inject the same text and burn context on a VRAM-bound box.
   * Called from beforeModelCall, which runs before the user's own message is added, so the answers
   * land in the history ahead of whatever the user is asking now.
   */
  private deliverAnsweredQuestions(phase: string): void {
    const answers = drainAnsweredQuestions(this.projectPath, phase);
    if (answers.length === 0) return;
    const body = answers.map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`).join('\n\n');
    this.memory.add(
      'user',
      `Answers to question(s) you asked earlier and I had not answered yet:\n\n${body}`,
    );
    renderer.systemMessage(`Delivered ${answers.length} saved answer(s) to ${titleCase(phase)}.`);
  }

  /**
   * Ctrl+C during a turn: stop whatever model call is generating. Returns false when nothing was in
   * flight, which is what lets the REPL fall the key through to its old meaning instead of swallowing a
   * press the user meant as "quit". One client serves every window, so this reaches the active phase, a
   * spawned Worker/Reviewer/Retro, a sub-agent and a throwaway one-shot alike.
   */
  cancelActiveTurn(): boolean {
    return this.llm.cancel();
  }

  /** Drop a cancel armed during a tool call that no later model call consumed — see the client's note. */
  clearPendingCancel(): void {
    this.llm.clearPendingCancel();
  }

  /**
   * The turn was cancelled or timed out. Keep what the model had produced, then branch the WHOLE exchange
   * — the user's message, every turn it caused, and this partial answer — off the live history, so the
   * next prompt opens where the exchange began and the user can rewrite it.
   *
   * Nothing is destroyed: markExchangeCancelled hides the turns and flushes them, so the abandoned branch
   * stays on disk and readable. The one thing that does NOT roll back is cost — the tokens those turns
   * spent are gone whatever the history says, so the phase total keeps them and this emits the event that
   * explains the gap they leave behind.
   */
  onAborted(reason: TurnAbortReason, partial: Message): void {
    const start = this.exchangeStartSeq;
    this.exchangeStartSeq = null;
    // The partial answer is added, not dropped: it is part of the branch being set aside, and a branch
    // missing the turn that was actually interrupted would be the one record worth having. Tokens are
    // omitted (⇒ null/null) — Ollama reports counts only on a final chunk this stream never got, and a
    // count that did not arrive is never estimated (constitution).
    const model = this.llm.model;
    if (partial.content !== '' || (partial.tool_calls && partial.tool_calls.length > 0)) {
      this.memory.add('assistant', partial.content, {
        ...(model !== undefined ? { model } : {}),
        ...(partial.tool_calls && partial.tool_calls.length > 0 ? { toolCalls: partial.tool_calls } : {}),
      });
    }
    // A null start means no user message opened this exchange (a spawned window's path, which does not
    // reach here). Nothing to branch, so keep the turn rather than hide an arbitrary slice of history.
    if (start === null) {
      this.memory.flush();
      return;
    }
    const turns = this.memory.markExchangeCancelled(start);
    appendEvent(this.projectPath, {
      type: 'turn_cancelled',
      phase: this.phase.name,
      detail: { reason, turns },
    });
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    // Persist the EXACT counts Ollama just reported for THIS turn (set by onTokens immediately prior
    // in the turn loop): prompt_eval_count→prompt, eval_count→completion. Never estimated. `model` is
    // the model that generated the turn — recorded per turn, so a mid-session `/models use` is visible
    // in the history rather than inferred from when the context started.
    const tokens = { prompt: this.lastTokens.promptTokens, completion: this.lastTokens.evalTokens };
    const model = this.llm.model;
    this.memory.add('assistant', content, {
      tokens,
      ...(model !== undefined ? { model } : {}),
      ...(toolCalls ? { toolCalls } : {}),
    });
    // An assistant turn is the flush point: everything buffered since the last one reaches memory.db in
    // ONE transaction, so a turn costs a single write and never a read. Tool results issued by THIS turn
    // are buffered and land with the next assistant turn, which always follows them.
    this.memory.flush();
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
      readTracker: this.trackerForActivePhase(), // survives this per-call context; see read-tracker.ts
    });
    // recordToolCall: every dispatched call — success, failure, or sub-step — is appended to the audit
    // log (V1/06) AND recorded in the scrollback as its `←` result line.
    return dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => recordToolCall(this.projectPath, record),
    });
  }

  /** System prompt (from the ACTIVE phase's instructions + project state) then that phase's history. */
  private buildMessages(): Message[] {
    // Same activeTools() call the stream uses, so the prompt's "# Your Tools" list is exactly the
    // surface this turn sends — including the registryOnly narrowing when the user swaps the active
    // phase to reviewer/retro, whose phase-scoped tools this path cannot serve.
    const system = buildSystemPrompt(
      this.phase.instructions,
      this.activeTools(),
      `Project: ${this.project}`,
    );
    return [{ role: 'system', content: system }, ...this.memory.history];
  }
}

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
