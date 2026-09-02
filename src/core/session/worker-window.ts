// One Worker window (V1/10): its own TurnContext over its own messages array, isolated from the
// session's per-phase histories and from the Reviewer that will judge it.
//
// It NEVER commits and never reviews its own work. The refusal list is what enforces that: a tool the
// Worker must not reach is refused here, audited, and reported back as a recoverable error, rather
// than being left out of the tool list and silently hallucinated.

import type { FileReadTracker } from './file-read-tracker.type.js';
import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { ToolCallRecord } from './tool-call-record.type.js';
import type { TurnContext } from './turn-context.type.js';
import type { WorkerDeps } from './worker-deps.type.js';
import { COMMIT_CHANGES } from '../../tools/commit-changes.js';
import { GIT_PUSH } from '../../tools/git-push.js';
import { GIT_STASH } from '../../tools/git-stash.js';
import { addTokenCounts } from './add-token-counts.js';
import { appendEvent } from './events-log.js';
import { loadPhasePrompt } from '../../context/load-phase-prompt.js';
import { buildSystemPrompt } from '../../context/system-prompt.js';
import { createReadTracker } from './read-tracker.js';
import { createToolContext } from '../../tools/create-tool-context.js';
import { dispatchToolCall } from './dispatch-tool-call.js';
import { evictStaleToolResults } from './evict-stale-tool-results.js';
import { recordToolCall } from './record-tool-call.js';
import { renderer } from '../ui/renderer.js';
import { resolvePhaseTools } from '../../phases/resolve-phase-tools.js';
import { toolError } from '../../tools/tool-error.js';
import { truncateHeadTail } from '../../tools/truncate.js';

// A test-first implement loop (write test → run → implement → run → summarize) needs more rounds
// than an interactive chat turn, so give the Worker generous headroom before the loop cap trips.
// Exported so the V3/01 fix loop reuses the SAME per-round budget it grants each interactive pass.
export const WORKER_MAX_ROUNDS = 24;

/** Max chars of a captured run_in_project result carried to the Reviewer (it can re-run for more). */
export const TEST_RUN_CAPTURE_LIMIT = 4000;

/**
 * The tools the Worker window refuses outright, each with the sentence the Worker is shown. These are
 * already absent from WORKER_TOOL_NAMES, so the model is never offered them — the refusal is the
 * second line of defense, because a model that recovers a tool call from bare JSON can name a tool it
 * was never offered.
 *
 * All three protect the same thing: the Reviewer's position as the gate between written code and the
 * git history. Committing its own work would make the Worker its own gatekeeper; stashing would let
 * it hide the work the Reviewer is about to judge; pushing publishes commits it did not make.
 */
const WORKER_REFUSALS: Readonly<Record<string, { readonly error: string; readonly hint: string }>> = {
  [COMMIT_CHANGES]: {
    error: 'the Worker cannot commit — the Reviewer commits the work it accepts.',
    hint: 'Finish the code and end with your SUMMARY. The Reviewer commits every file it accepts and returns the rest to you with notes.',
  },
  [GIT_STASH]: {
    error: 'the Worker cannot stash — your work must stay in the working tree for the Reviewer to judge.',
    hint: 'Leave the code where it is. If you need to move to another branch, git_branch with action:"create" carries your changes with you.',
  },
  [GIT_PUSH]: {
    error: 'the Worker cannot push — it has no commits of its own, because it does not commit.',
    hint: 'Finish the code and end with your SUMMARY. Publishing is not part of implementing a task.',
  },
};

/**
 * A single Worker window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories (Foundation/06) and from other tasks. Tool calls
 * dispatch through the shared registry and are audited as phase "worker". Reused ACROSS the V3/01 fix
 * loop (created once per task, never reset between rounds); one class = one cohesive unit.
 */
export class WorkerWindow implements TurnContext {
  readonly activePhase = 'worker';
  readonly messages: Message[];
  /** The last assistant turn with no tool calls — the Worker's summary to the user. */
  summary = '';
  /** The Worker's last run_in_project invocation (command + output tail), for the Reviewer's seed. */
  lastTestRun: string | null = null;
  /** Running EXACT sum of every turn's tokens (a null metric poisons the sum — never estimated). */
  private tokenSum: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  /** `evictionThresholdRatio × num_ctx` — the exact prompt size at which this window starts stubbing. */
  private readonly evictionThreshold: number;
  /**
   * The EXACT prompt_eval_count that tripped eviction, held until the pass runs; `null` when no pass is
   * owed. Non-null doubles as "scheduled" because a pass is only ever scheduled on a real count — a
   * metric Ollama omitted cannot ground a VRAM decision, so it schedules nothing (never estimate).
   */
  private evictionScheduledAt: number | null = null;
  /**
   * A pass that has RUN and is waiting for the next turn to report the real post-eviction prompt size.
   * `after` is unknowable at pass time (the new prompt has not been evaluated yet) and computing one
   * would be an estimate, so the row is deferred exactly as summarization_fire defers its own.
   */
  private evictionAwaitingAfter: { before: number; evicted: number; fromIndex: number } | null = null;
  /** The Worker's allowlist from phase-tool-names.ts — notably without commit_changes (see callTool). */
  private readonly workerTools: Tool[];
  /**
   * What this window has read, backing the look-before-you-write guard on write_file/edit_file. One per
   * WorkerWindow, so it lives exactly as long as the window does — created once per task and kept
   * across all five fix rounds, like `messages`. That is deliberate: a read stays valid for as long as
   * the bytes do, and the Reviewer drives git between rounds, so what catches a file changing under the
   * Worker is the staleness half (a content hash), not an expiry.
   */
  private readonly readTracker: FileReadTracker = createReadTracker();

  constructor(private readonly deps: WorkerDeps) {
    // The Worker is the ONE phase that cannot commit: a Worker that commits its own code is its own
    // gatekeeper. It hands everything to the Reviewer, which commits what it accepts and returns the
    // rest with notes. WORKER_TOOL_NAMES omits commit_changes, git_stash and git_push so it cannot
    // see them at all, AND callTool refuses all three (WORKER_REFUSALS) — the registry is global, so
    // the definition list alone is not a guarantee.
    // Resolved BEFORE the prompt: buildSystemPrompt renders this same array into the "# Your Tools"
    // list, so the three absences are stated to the model rather than left as a silent gap.
    this.workerTools = resolvePhaseTools('worker');
    // The window builds its own system prompt from rules/phases/worker.md (V1/01), read fresh here.
    const systemPrompt = buildSystemPrompt(
      loadPhasePrompt('worker'),
      this.workerTools,
      `Project: ${deps.projectName}`,
    );
    this.messages = [{ role: 'system', content: systemPrompt }];
    // The ceiling comes off the CLIENT, which is what actually puts num_ctx on the wire, so it can never
    // drift from what Ollama was told; the ratio comes from config, which owns tuning values. `baseNumCtx`
    // is the right one of the two ceilings on purpose: the Worker is a WINDOW role, and window roles all
    // run at the base value — only the bounded one-shots get a smaller lane of their own.
    this.evictionThreshold = deps.llm.baseNumCtx * deps.evictionThresholdRatio;
  }

  /** EXACT summed tokens across every turn of this window's whole life (all fix rounds). */
  get tokens(): TokenCounts {
    return this.tokenSum;
  }

  streamAsk(userInput: string): StreamHandle {
    this.messages.push({ role: 'user', content: userInput });
    return this.deps.llm.stream('worker', this.messages, this.workerTools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream('worker', this.messages, this.workerTools);
  }

  onTokens(tokens: TokenCounts): void {
    // Sum exact counts across every turn so the V3/01 loop can report the Worker's whole-task cost.
    this.tokenSum = addTokenCounts(this.tokenSum, tokens);
    // A pass ran before THIS call, so this call's prompt_eval_count IS the exact post-eviction size —
    // the deferred "after" the pass itself could not know.
    const awaiting = this.evictionAwaitingAfter;
    if (awaiting !== null) {
      this.evictionAwaitingAfter = null;
      this.emitEvictionFire(awaiting, tokens.promptTokens);
    }
    // Trigger: schedule a pass before the next model call once this window's EXACT prompt size reaches
    // the ratio. A null count never schedules — a guess is not a basis for rewriting history.
    if (tokens.promptTokens !== null && tokens.promptTokens >= this.evictionThreshold) {
      this.evictionScheduledAt = tokens.promptTokens;
    }
  }

  /**
   * Late-batch eviction (the turn loop awaits this before EVERY model call — turn-loop.ts). The Worker
   * is the one window whose history persists across all five review rounds by design, and it has no
   * summarization failsafe at all, so without this its only bound is Ollama silently dropping its oldest
   * tokens at num_ctx.
   *
   * Costs no inference: it rewrites the array and returns. What it does cost is prompt re-evaluation
   * from the earliest message it touched, which is why the pass refuses to touch the head of the window
   * — see evict-stale-tool-results.ts for the measurements that fixed that rule.
   */
  async beforeModelCall(): Promise<void> {
    if (this.evictionScheduledAt === null) return;
    const before = this.evictionScheduledAt;
    // Cleared on every trip, acted on or not: a pass that declines must not re-run on every subsequent
    // call. onTokens simply reschedules for as long as the window stays over the threshold.
    this.evictionScheduledAt = null;
    // evictStaleToolResults: stub older tool results in place, NEVER a message earlier than the newest
    // surviving half of the window, and never the newest few results. An empty list means acting would
    // have meant reaching into the head — so it defers rather than paying a full re-evaluation.
    const rewrites = evictStaleToolResults(this.messages);
    const first = rewrites[0];
    if (first === undefined) return;
    for (const rewrite of rewrites) {
      const message = this.messages[rewrite.index];
      // Rewritten in place: the stub REPLACES the result's text and the message itself stays, so the
      // assistant tool_call it answers keeps its partner and the chat template still renders.
      if (message !== undefined) message.content = rewrite.content;
    }
    // One line, because the user is about to wait through a prompt re-evaluation and an unexplained
    // pause in an unattended run is exactly what the tool-call record exists to end.
    const plural = rewrites.length === 1 ? '' : 's';
    renderer.systemMessage(`Freeing Worker context: stubbed ${rewrites.length} older tool result${plural}.`);
    this.evictionAwaitingAfter = { before, evicted: rewrites.length, fromIndex: first.index };
  }

  /**
   * Write the deferred `eviction_fire` row. `before` is always a real count (nothing schedules on a
   * null); `after` is omitted and the row flagged `incomplete` when Ollama did not report one, rather
   * than filled in — a missing metric is surfaced, never papered over (constitution).
   */
  private emitEvictionFire(
    pass: { before: number; evicted: number; fromIndex: number },
    after: number | null,
  ): void {
    const detail: Record<string, string | number | boolean> = {
      evicted: pass.evicted,
      // The index the rewrite started at IS the point Ollama re-evaluates the prompt from, so this is
      // the field that explains what the pass cost in wall clock.
      from_index: pass.fromIndex,
      before: pass.before,
    };
    if (after !== null) detail['after'] = after;
    else detail['incomplete'] = true;
    appendEvent(this.deps.projectPath, { type: 'eviction_fire', phase: this.activePhase, detail });
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    const entry: Message = { role: 'assistant', content };
    if (toolCalls && toolCalls.length > 0) {
      entry.tool_calls = toolCalls;
    } else {
      this.summary = content; // a no-tool-call turn is the Worker's final summary
    }
    this.messages.push(entry);
  }

  addToolResult(toolName: string, result: string): void {
    this.messages.push({ role: 'tool', content: result, tool_name: toolName });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    // commit_changes / git_stash / git_push are global registry tools, so the dispatcher WOULD run
    // them if asked. Refuse them here (recoverable + audited) rather than relying on their absence
    // from the definitions — see WORKER_REFUSALS.
    const refusal = WORKER_REFUSALS[name];
    if (refusal !== undefined) {
      return this.refuse(name, args, refusal.error, refusal.hint);
    }
    const ctx = createToolContext({
      projectName: this.deps.projectName,
      projectPath: this.deps.projectPath,
      sandbox: this.deps.sandbox,
      phase: 'worker',
      llm: this.deps.llm, // backs ctx.oneShot for search_rules (V4/02)
      readTracker: this.readTracker, // this window's own; a sub-agent's reads never reach it
    });
    const result = await dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => recordToolCall(this.deps.projectPath, record),
    });
    // Remember the last test/build run so V2/02 can seed the Reviewer with the Worker's own results.
    if (name === 'run_in_project') {
      const command = typeof args['command'] === 'string' ? args['command'] : '';
      this.lastTestRun = `$ ${command}\n${truncateHeadTail(result, TEST_RUN_CAPTURE_LIMIT)}`;
    }
    return result;
  }

  /** Refuse a withheld tool with a recoverable message, and audit the attempt like any other call. */
  private refuse(name: string, args: Record<string, unknown>, message: string, hint: string): string {
    const err = toolError(message, hint);
    const output = typeof err.content === 'string' ? err.content : JSON.stringify(err.content);
    const record: ToolCallRecord = {
      ts: new Date().toISOString(),
      phase: 'worker',
      tool: name,
      args,
      exitStatus: -1,
      durationMs: 0,
      output,
      error: message,
    };
    recordToolCall(this.deps.projectPath, record);
    return output;
  }
}
