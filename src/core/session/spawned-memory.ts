// Everything ONE spawned window needs from backlog item 9, behind one object: its trace in memory.db
// (spawned-trace.ts) and its summarization failsafe (compact-spawned-window.ts). The six spawned windows
// — Worker, Reviewer, Retro, sub-agent, and the challenger and proponent of a debate — plus the debate's
// digest each hold one, and call it at the same five points of their loop.
//
// The window keeps its own messages array (the user's choice); this object is handed that array to
// APPEND to, rather than the window pushing onto it, because the trace's row numbering is aligned with
// the array's indices and a push that skipped the trace would silently misnumber every later collapse.
//
// The failsafe mirrors the interactive one in SessionOrchestrator, deliberately:
//   - The TRIGGER is the existing SUMMARIZATION_THRESHOLD_RATIO against the EXACT prompt_eval_count of
//     the window's latest call (#25a) — never a length estimate, and a null count never schedules.
//   - A pass is scheduled by one call and runs before the NEXT, so the imminent call runs on the
//     shrunken history; it is cleared on every trip, and simply reschedules while the window stays large.
//   - The `summarization_fire` row is DEFERRED to the next call, whose exact count is the honest "after".
//
// The flush point is the model's reply — one transaction per reply, the rhythm the user chose when item
// 9 was built — so a kill loses at most the turn in flight; `flush()` is there for a window's end, to
// write whatever its last exchange left buffered.

import type { Message } from 'ollama';

import type { OllamaClient } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import { renderer } from '../ui/renderer.js';
import { theme } from '../ui/theme.js';
import { compactSpawnedWindow } from './compact-spawned-window.js';
import { appendEvent } from './events-log.js';
import { spawnedPhase } from './spawned-phase.js';
import { SpawnedTrace } from './spawned-trace.js';
import type { SpawnedWindowSpec } from './spawned-window-spec.type.js';

/** The counts a user or tool turn is recorded with: no generation produced it, so there are none. */
const NO_TURN_TOKENS = { prompt: null, completion: null } as const;

export class SpawnedMemory {
  private readonly trace: SpawnedTrace;
  /** `ratio × num_ctx`, or null for a window that never compacts. */
  private readonly threshold: number | null;
  /** The latest call's EXACT counts — what the reply recorded next is stamped with. */
  private lastTokens: TokenCounts = { promptTokens: null, evalTokens: null };
  /** The exact prompt size that scheduled a pass, or null when none is due. */
  private scheduledAt: number | null = null;
  /** A pass ran, and its event waits for the next call's count as its "after". */
  private awaitingAfter: number | null = null;

  constructor(
    private readonly llm: OllamaClient,
    private readonly projectPath: string,
    private readonly spec: SpawnedWindowSpec,
  ) {
    // spawnedPhase: `<base>:spawned`, which /resume can never list. `baseNumCtx` is the raw
    // OLLAMA_NUM_CTX — every window role resolves to it exactly, so it is the honest stamp.
    this.trace = new SpawnedTrace(projectPath, llm.baseNumCtx, spawnedPhase(spec.base), spec.title);
    this.threshold = spec.summarizationThresholdRatio === null ? null : spec.summarizationThresholdRatio * llm.baseNumCtx;
  }

  /** Append a user or tool message to the window and record it. */
  append(messages: Message[], message: Message): void {
    messages.push(message);
    this.trace.record(message, NO_TURN_TOKENS, undefined);
  }

  /**
   * Append the model's reply, record it with the exact counts `observe` was last given and the model that
   * wrote it, and flush — the reply is the flush point.
   */
  appendReply(messages: Message[], message: Message): void {
    messages.push(message);
    this.trace.record(message, { prompt: this.lastTokens.promptTokens, completion: this.lastTokens.evalTokens }, this.llm.model);
    this.trace.flush();
  }

  /**
   * Feed a completed call's EXACT counts: they stamp the reply recorded next, close out a deferred
   * `summarization_fire`, and schedule a pass when the prompt reached the threshold.
   */
  observe(tokens: TokenCounts): void {
    this.lastTokens = tokens;
    const before = this.awaitingAfter;
    if (before !== null) {
      this.awaitingAfter = null;
      this.emitSummarizationFire(before, tokens.promptTokens);
    }
    if (this.threshold !== null && tokens.promptTokens !== null && tokens.promptTokens >= this.threshold) {
      this.scheduledAt = tokens.promptTokens;
    }
  }

  /** Before the window's next model call: compact it when the last call scheduled a pass. */
  async beforeCall(messages: Message[]): Promise<void> {
    if (this.scheduledAt === null) return;
    const before = this.scheduledAt;
    this.scheduledAt = null;
    // compactSpawnedWindow: the oldest half past the seed becomes one summary, in place and in memory.db.
    // Its one status line is printed only when there is something to collapse — through interjectLine,
    // not a bare write, because a sub-agent's or a debate's window runs inside its parent's tool call,
    // where the transient activity line owns the cursor row.
    const result = await compactSpawnedWindow(this.llm, messages, this.trace, () =>
      renderer.interjectLine(theme.meta(`Compacting ${this.spec.label} history (failsafe)...`)),
    );
    if (result !== null) this.awaitingAfter = before;
  }

  /** Write whatever the window's last exchange left buffered — a tool result at a round cap, say. */
  flush(): void {
    this.trace.flush();
  }

  /**
   * The deferred `summarization_fire` row, in the interactive failsafe's shape. `after` is omitted and the
   * row flagged `incomplete` when Ollama did not report one — never filled in.
   */
  private emitSummarizationFire(before: number, after: number | null): void {
    const detail: Record<string, string | number | boolean> = { ...this.spec.eventDetail, before };
    if (after !== null) detail['after'] = after;
    else detail['incomplete'] = true;
    appendEvent(this.projectPath, {
      type: 'summarization_fire',
      phase: this.spec.eventPhase,
      ...(this.spec.subagentId !== undefined ? { subagentId: this.spec.subagentId } : {}),
      detail,
    });
  }
}
