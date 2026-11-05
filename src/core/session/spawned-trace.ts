// The write path for ONE spawned window's trace in memory.db (backlog item 9, #81 / #97): a `contexts`
// row of its own and a `messages` row per turn, through exactly the SQL helpers SessionMemory uses, so
// the rows are indistinguishable in shape from an interactive phase's and readable with the same
// queries. It is the "small dedicated writer" the user chose over routing spawned windows through
// SessionMemory: the window's RAM array stays its working copy, and this only appends to the database.
//
// WHAT IS WRITTEN IS WHAT WAS GENERATED. A row is written once and never rewritten: the Worker's eviction
// stubs a tool result in RAM only, so the database keeps the original. A summary is a NEW `summary` row
// that the turns it collapsed point `replaced_by` at — the interactive failsafe's own shape.
//
// The system prompt at the window's index 0 is never a row: the `messages.role` CHECK has no `system`,
// and the prompt is a file under rules/ anyway. So the trace numbers the window from index 1, and
// `seqs[i - 1]` is the row behind the window's message `i`. That alignment is the whole contract with
// the caller: every message the window appends past index 0 must be recorded here, in order, which is
// why spawned-memory.ts does the appending and the windows never push onto their arrays themselves.
//
// A connection is opened per flush and closed again. A spawned window has no shutdown hook to close a
// long-lived handle in, and a flush happens once per model reply, which takes seconds — the few
// milliseconds of opening are not worth a handle that could outlive the window.

import type { Message } from 'ollama';

import { capTitle } from './cap-title.js';
import { collapseIntoSummary } from './collapse-into-summary.js';
import { flushContext } from './flush-context.js';
import type { MemoryRecord } from './memory-record.type.js';
import { openMemoryDb } from './open-memory-db.js';
import { setContextTitle } from './set-context-title.js';
import type { TurnTokens } from './turn-tokens.type.js';

export class SpawnedTrace {
  /** The context row's UUID, or null before the first flush has created it. */
  private contextId: string | null = null;
  /** The `seq` the next row will take (1-based, never reused — a summary takes one too). */
  private nextSeq = 1;
  /** Rows recorded since the last flush, in order. */
  private pending: MemoryRecord[] = [];
  /** The row behind each of the window's messages from index 1 on — see the header. */
  private readonly seqs: number[] = [];

  constructor(
    private readonly projectPath: string,
    /** The EXACT OLLAMA_NUM_CTX, stamped on the context row like any other. */
    private readonly numCtx: number,
    /** The namespaced phase — `worker:spawned` and the like (spawned-phase.ts). */
    private readonly phase: string,
    /** Written by the orchestrator, not a model: which task, sub-agent or claim this window served. */
    private readonly title: string,
  ) {}

  /**
   * Record the message the window just appended. `tokens` are the EXACT counts of the call that produced
   * it (null/null for user and tool turns, which no generation produced); `model` likewise only for a
   * generated turn.
   */
  record(message: Message, tokens: TurnTokens, model: string | undefined): void {
    const role = message.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'tool') {
      throw new Error(`spawned trace '${this.phase}': cannot record a '${role}' message past the system prompt`);
    }
    const record: MemoryRecord = {
      seq: this.nextSeq,
      ts: new Date().toISOString(),
      role,
      content: message.content,
      tokens,
      ...(model !== undefined ? { model } : {}),
      ...(message.tool_name !== undefined ? { tool_name: message.tool_name } : {}),
      ...(message.tool_calls !== undefined && message.tool_calls.length > 0 ? { tool_calls: message.tool_calls } : {}),
    };
    this.nextSeq += 1;
    this.seqs.push(record.seq);
    this.pending.push(record);
  }

  /** Write everything recorded since the last flush in one transaction, creating the context on the first. */
  flush(): void {
    if (this.pending.length === 0) return;
    const db = openMemoryDb(this.projectPath);
    try {
      const created = this.contextId === null;
      // flushContext: one transaction — creates the context row when contextId is null, then inserts
      // every pending row with its own timestamp.
      this.contextId = flushContext(db, {
        contextId: this.contextId,
        phase: this.phase,
        numCtx: this.numCtx,
        records: this.pending,
      });
      // capTitle: the same 60-character, word-boundary cap every stored title gets.
      if (created) setContextTitle(db, this.contextId, capTitle(this.title));
      this.pending = [];
    } finally {
      db.close();
    }
  }

  /**
   * The window replaced its messages `[from, from + count)` with ONE summary message at `from`. Flushes
   * first, so every collapsed turn is a row the summary can point at, then writes the `summary` row and
   * marks the collapsed rows `replaced_by` it — the originals stay, hidden only from a visible view.
   */
  collapse(from: number, count: number, content: string, tokens: TurnTokens, model: string | undefined): void {
    this.flush();
    if (this.contextId === null) {
      throw new Error(`spawned trace '${this.phase}': nothing has been written, so there is nothing to collapse`);
    }
    const replaced = this.seqs.slice(from - 1, from - 1 + count);
    const summary: MemoryRecord = {
      seq: this.nextSeq,
      ts: new Date().toISOString(),
      role: 'summary',
      content,
      tokens,
      ...(model !== undefined ? { model } : {}),
    };
    this.nextSeq += 1;
    const db = openMemoryDb(this.projectPath);
    try {
      // collapseIntoSummary: inserts the summary row and points every collapsed row's `replaced_by` at it.
      collapseIntoSummary(db, this.contextId, summary, replaced);
    } finally {
      db.close();
    }
    this.seqs.splice(from - 1, count, summary.seq);
  }
}
