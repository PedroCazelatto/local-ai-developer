// SessionMemory — one isolated message history PER phase, backed by SQLite (memory.db) under
// projects/<active>/.orchestrator/. Each phase's turns accumulate in a CONTEXT: a first-class row that
// can be listed, titled and reopened by address, rather than a filename that had to be renamed to
// change state. Switching phases only moves the active pointer; histories never leak because each phase
// owns its own buffer and its own context row.
//
// RAM IS AUTHORITATIVE DURING A TURN. Turns are buffered and written once per assistant turn (flush),
// so a turn costs one transaction and never a read: `seq` is assigned here and the context id is held
// here. The cost, stated plainly: a kill mid-turn loses the buffered turn.
//
// WHICH CONTEXT IS LIVE IS SESSION STATE, NOT DATA. Nothing in the database says "this one is current";
// the live context per phase lives in this map and dies with the process. Every boot therefore starts a
// phase on a FRESH context and reaches an older one only when the user reopens it — see docs/mental-model.md.
//
// A context row is created LAZILY, on its first flush. A phase the user never talked to leaves no row,
// and a session with no model selected — which cannot produce an answer — creates nothing at all.

import type { DatabaseSync } from 'node:sqlite';

import type { Message, ToolCall } from '../llm/index.js';
import {
  collapseIntoSummary,
  flushContext,
  listContexts,
  markCancelled,
  maxSeq,
  openMemoryDb,
  readContextSummary,
  readVisibleMessages,
  resolveContextId,
  setContextTitle,
} from './memory-db.js';
import type { ContextSummary, ClearResult, MemoryRecord, PhaseLoad, TurnTokens } from './memory-db.type.js';

/** Valid chat roles for a stored message. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** The roles a turn is persisted under through `add` (`summary` goes through appendSummary). */
type PersistableRole = 'user' | 'assistant' | 'tool';

interface AddOptions {
  /** Tool name for a `tool` result message (stored as `tool_name`, serialized as Ollama's `tool_name`). */
  readonly toolName?: string;
  /** Structured tool calls for an assistant turn that issued them. */
  readonly toolCalls?: ToolCall[];
  /**
   * EXACT Ollama counts for the turn that produced this record — `prompt_eval_count`→`prompt`,
   * `eval_count`→`completion`. Omitted (⇒ null/null) for user and tool turns, which no generation
   * produced. NEVER a length-based estimate (constitution: token counts are always exact).
   */
  readonly tokens?: TurnTokens;
  /** The model that GENERATED this turn. Omitted for user/tool turns — no generation produced them. */
  readonly model?: string;
}

/** One phase's live state: its context, every turn in RAM, and what has yet to reach the database. */
interface PhaseState {
  /** The live context's UUID, or null before its first flush has created the row. */
  contextId: string | null;
  /** Every turn in RAM — collapsed ones included, so `seq` never repeats within a context. */
  records: MemoryRecord[];
  /** Turns added since the last flush, in order. */
  pending: MemoryRecord[];
  /** The `seq` the next turn will take (1-based). */
  nextSeq: number;
  /** The live context's title, or null while it has none. */
  title: string | null;
  /** Whether a title has already been attempted for this context — one try per context per session. */
  titleAttempted: boolean;
}

/** A phase's state on first use: no context row yet, nothing buffered, numbering from 1. */
function freshState(): PhaseState {
  return { contextId: null, records: [], pending: [], nextSeq: 1, title: null, titleAttempted: false };
}

export class SessionMemory {
  private readonly db: DatabaseSync;
  private readonly phases = new Map<string, PhaseState>();
  private active: string | null = null;

  /**
   * `numCtx` is the EXACT OLLAMA_NUM_CTX every context created in this session is stamped with, and the
   * ceiling every listing filters on — a context built under a different one is hidden rather than
   * replayed into a window that would silently drop its oldest tokens.
   */
  constructor(projectPath: string, private readonly numCtx: number) {
    this.db = openMemoryDb(projectPath);
  }

  /** Point at a phase's history, starting it on a fresh context the first time it is activated. */
  activatePhase(name: string): void {
    if (!this.phases.has(name)) {
      this.phases.set(name, freshState());
    }
    this.active = name;
  }

  /** Append a message to the ACTIVE phase's history. Buffered in RAM until the next `flush`. */
  add(role: PersistableRole, content: string, opts?: AddOptions): void {
    const state = this.requireState();
    const record: MemoryRecord = {
      seq: state.nextSeq,
      ts: new Date().toISOString(),
      role,
      content,
      tokens: opts?.tokens ?? { prompt: null, completion: null },
      ...(opts?.model !== undefined ? { model: opts.model } : {}),
      ...(opts?.toolName !== undefined ? { tool_name: opts.toolName } : {}),
      ...(opts?.toolCalls && opts.toolCalls.length > 0 ? { tool_calls: opts.toolCalls } : {}),
    };
    state.nextSeq += 1;
    state.records.push(record);
    state.pending.push(record);
  }

  /**
   * Write everything buffered for the ACTIVE phase in one transaction, creating its context row if this
   * is the first flush. Called after each assistant turn. A no-op when nothing is pending, so a phase
   * that only read its inbox never creates a context.
   */
  flush(): void {
    if (this.active === null) return;
    const state = this.phases.get(this.active);
    if (state !== undefined) this.flushPhase(this.active, state);
  }

  /**
   * Flush EVERY phase and close the database. Called once, when the session ends: it commits anything
   * a phase left buffered — a phase swapped away from mid-exchange, or a user turn whose model call
   * then failed — and closes the handle so SQLite checkpoints the WAL and removes its sidecar files.
   */
  close(): void {
    for (const [phase, state] of this.phases) {
      this.flushPhase(phase, state);
    }
    this.db.close();
  }

  /** Write one phase's buffered turns, creating its context row on the first flush. No-op when empty. */
  private flushPhase(phase: string, state: PhaseState): void {
    if (state.pending.length === 0) return;
    // flushContext: one transaction — create the context when contextId is null, then insert every
    // buffered turn. Returns the context's UUID (generated by SQLite's column DEFAULT).
    state.contextId = flushContext(this.db, {
      contextId: state.contextId,
      phase,
      numCtx: this.numCtx,
      records: state.pending,
    });
    state.pending = [];
  }

  /**
   * Summarization failsafe: append a `summary` turn that COLLAPSES the turns in `replacedSeqs`. Flushes
   * first, so every turn being collapsed is already a row the summary can point `replaced_by` at. The
   * originals stay in the database — only the visible view drops them — and `tokens` are the throwaway
   * summarization call's EXACT counts.
   */
  appendSummary(content: string, replacedSeqs: readonly number[], tokens: TurnTokens, model?: string): void {
    const phase = this.requireActive();
    const state = this.requireState();
    this.flush();
    if (state.contextId === null) {
      throw new Error(`cannot summarize phase '${phase}': it has no persisted context`);
    }
    const summary: MemoryRecord = {
      seq: state.nextSeq,
      ts: new Date().toISOString(),
      role: 'summary',
      content,
      tokens,
      ...(model !== undefined ? { model } : {}),
    };
    state.nextSeq += 1;
    // collapseIntoSummary: insert the summary row, then set every collapsed turn's `replaced_by` to it.
    collapseIntoSummary(this.db, state.contextId, summary, replacedSeqs);
    const replaced = new Set(replacedSeqs);
    state.records = state.records.map((record) =>
      replaced.has(record.seq) ? { ...record, replacedBySeq: summary.seq } : record,
    );
    state.records.push(summary);
  }

  /**
   * The active phase's CURRENTLY-VISIBLE turns (already-collapsed ones dropped) — the summarizer's input
   * for its oldest-50% selection. Empty when no phase is active.
   */
  activeVisibleRecords(): readonly MemoryRecord[] {
    if (this.active === null) return [];
    return visibleOf(this.phases.get(this.active)?.records ?? []);
  }

  /** The active phase's live message array (collapsed turns dropped; empty if no phase is active). */
  get history(): Message[] {
    if (this.active === null) return [];
    return visibleOf(this.phases.get(this.active)?.records ?? []).map(toMessage);
  }

  /**
   * The `seq` the active phase's NEXT added turn will take. Snapshotted before a turn's user message is
   * added, so that cancelling can name exactly where the exchange began — everything from that seq
   * onward is what the cancel branches off. Reading it never mutates anything.
   */
  get activeNextSeq(): number {
    if (this.active === null) return 1;
    return this.phases.get(this.active)?.nextSeq ?? 1;
  }

  /**
   * Cancel the active phase's exchange starting at `fromSeq`: every turn from there on — the user
   * message, whatever the model answered, the tool calls it made and their results — leaves the live
   * history, so the next prompt starts from where the exchange began and the user can rewrite it.
   *
   * NOTHING IS DELETED. Turns already on disk are stamped in place, turns still buffered carry the stamp
   * into their own INSERT, and the buffer is flushed here so a cancelled exchange is preserved rather
   * than dropped on the floor — hidden from the window, readable for audit. `seq` is not reclaimed, so
   * the branch keeps its numbering and later turns continue past the gap (`UNIQUE (context_id, seq)`
   * governs hidden rows too). Returns how many turns were branched off.
   */
  markExchangeCancelled(fromSeq: number): number {
    const state = this.requireState();
    const cancelledAt = new Date().toISOString();
    const affected = state.records.filter(
      (record) => record.seq >= fromSeq && record.cancelledAt === undefined,
    );
    if (affected.length === 0) return 0;

    // Which turns had not reached the database yet — they get the stamp through their own INSERT.
    const buffered = new Set(state.pending.map((record) => record.seq));
    const stamp = (record: MemoryRecord): MemoryRecord =>
      record.seq >= fromSeq && record.cancelledAt === undefined ? { ...record, cancelledAt } : record;
    state.records = state.records.map(stamp);
    // Rebuilt from the NEW records rather than mapped separately: `pending` holds the same objects as
    // `records`, and stamping produced replacements, so re-selecting by seq is what keeps the two in step.
    state.pending = state.records.filter((record) => buffered.has(record.seq));

    const flushed = affected.filter((record) => !buffered.has(record.seq)).map((record) => record.seq);
    if (state.contextId !== null && flushed.length > 0) {
      // markCancelled: one transaction stamping every already-persisted turn of the exchange.
      markCancelled(this.db, state.contextId, flushed, cancelledAt);
    }
    // Land the buffered turns now that they are marked. They are invisible either way; flushing is what
    // makes the cancelled branch inspectable instead of lost when the process ends.
    this.flush();
    return affected.length;
  }

  /** The live context's UUID for the active phase, or null before its first flush created the row. */
  get activeContextId(): string | null {
    if (this.active === null) return null;
    return this.phases.get(this.active)?.contextId ?? null;
  }

  /**
   * `/clear`: start the active phase on a NEW context. Flushes first so nothing buffered is lost, then
   * reports the context it set aside — which `/resume` can reopen — or null when the phase had none.
   * Nothing is deleted: the previous context keeps every turn it held.
   */
  clearActive(): ClearResult {
    const phase = this.requireActive();
    const state = this.requireState();
    this.flush();
    const cleared = state.contextId === null ? null : readContextSummary(this.db, state.contextId);
    this.phases.set(phase, freshState());
    return { phase, cleared };
  }

  /**
   * The active phase's last `limit` contexts, most recently active first, EXCLUDING the live one.
   * Contexts written under a different `num_ctx` are omitted (see memory-db.listContexts).
   */
  contextsForActive(limit: number): ContextSummary[] {
    const phase = this.requireActive();
    return listContexts(this.db, phase, this.numCtx, limit, this.activeContextId);
  }

  /**
   * Reopen one of the active phase's contexts, addressed by its UUID or any unique leading prefix.
   * Flushes the live context first (it keeps its turns and stays reopenable), then replays the chosen
   * context's visible turns into RAM. Returns null when the address matches no single context of this
   * phase — the caller turns that into a recoverable line rather than acting on a guess.
   */
  reopenActiveContext(address: string): PhaseLoad | null {
    const phase = this.requireActive();
    // resolveContextId: a full UUID or a unique prefix, restricted to this phase and the current num_ctx.
    const contextId = resolveContextId(this.db, phase, this.numCtx, address);
    if (contextId === null) return null;
    this.flush();
    const summary = readContextSummary(this.db, contextId);
    const records = readVisibleMessages(this.db, contextId);
    this.phases.set(phase, {
      contextId,
      records,
      pending: [],
      // Past the highest seq EVER used, collapsed turns included — a reused seq would collide with
      // `UNIQUE (context_id, seq)` and abort the next flush.
      nextSeq: maxSeq(this.db, contextId) + 1,
      title: summary?.title ?? null,
      // A reopened context that still has no title gets one more chance, from the next answer in this
      // session. Note what it is titled FROM: generateContextTitle reads the whole visible history, so
      // that attempt sees the entire REPLAYED context, not only the turns added since the reopen. That
      // is deliberate — a title says why the context exists, which its opening establishes and its
      // latest turn does not — and it is why buildTranscript bounds what the titler is handed.
      titleAttempted: false,
    });
    return { contextId, turns: records.length, lastPromptTokens: lastPromptTokensOf(records) };
  }

  /**
   * Whether the active phase's live context should be titled now: it has a row, no title yet, no attempt
   * this session, and at least one assistant turn carrying real prose. Tool-call turns are stored with
   * empty content on purpose (see turn-loop.ts), and a title drawn from those would describe nothing.
   */
  activeNeedsTitle(): boolean {
    if (this.active === null) return false;
    const state = this.phases.get(this.active);
    if (state === undefined || state.contextId === null) return false;
    if (state.title !== null || state.titleAttempted) return false;
    return state.records.some((record) => record.role === 'assistant' && record.content.trim() !== '');
  }

  /** Record that a title was attempted for the live context — one try per context per session. */
  markActiveTitleAttempted(): void {
    const state = this.phases.get(this.active ?? '');
    if (state !== undefined) state.titleAttempted = true;
  }

  /** Give the active phase's live context its title (no-op when the context row does not exist yet). */
  setActiveTitle(title: string): void {
    const state = this.requireState();
    if (state.contextId === null) return;
    setContextTitle(this.db, state.contextId, title);
    state.title = title;
  }

  private requireActive(): string {
    if (this.active === null) {
      throw new Error('No active phase set');
    }
    return this.active;
  }

  private requireState(): PhaseState {
    const phase = this.requireActive();
    const state = this.phases.get(phase);
    if (state === undefined) {
      throw new Error(`phase '${phase}' was never activated`);
    }
    return state;
  }
}

/** The turns a phase still sees: everything no summary has collapsed and no cancel has branched off. */
function visibleOf(records: readonly MemoryRecord[]): MemoryRecord[] {
  return records.filter((record) => record.replacedBySeq === undefined && record.cancelledAt === undefined);
}

/**
 * Map a stored role to a chat role. `summary` replays as an assistant note — it stands in the history
 * where the turns it collapsed used to be, and any other role would break the chat template on replay.
 */
function chatRole(role: MemoryRecord['role']): Message['role'] {
  return role === 'summary' ? 'assistant' : role;
}

/** Rebuild one record into the Ollama Message shape (mirrors SessionMemory.add's field handling). */
function toMessage(record: MemoryRecord): Message {
  const message: Message = { role: chatRole(record.role), content: record.content };
  if (record.tool_name !== undefined) message.tool_name = record.tool_name;
  if (record.tool_calls !== undefined && record.tool_calls.length > 0) message.tool_calls = record.tool_calls;
  return message;
}

/** The most recent EXACT prompt_eval_count among the records, or null if none recorded one (never estimated). */
function lastPromptTokensOf(records: readonly MemoryRecord[]): number | null {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const prompt = records[i]?.tokens.prompt;
    if (typeof prompt === 'number') return prompt;
  }
  return null;
}
