// SessionMemory — one isolated message history PER phase, now BACKED by append-only JSONL under
// projects/<active>/.orchestrator/memory/ (V4/04). It keeps each phase's records in RAM, appends
// every turn to that phase's `<phase>.jsonl`, and rebuilds the in-RAM view when a phase is activated
// — so killing `run start` and restarting no longer loses a phase's context. Switching phases only
// moves the active pointer; histories never leak because each phase owns its own array AND its own
// file. All disk work is delegated to memory-store.ts (this class owns only the in-RAM state).
//
// LAZY LOAD: only the phase that just became active is read from disk (VRAM/RAM frugality; there is
// exactly one active phase, no parallelism — CLAUDE.md). Single-process + single-active-phase means
// count-then-append is race-free, so no locking is needed.

import type { Message, ToolCall } from '../llm/index.js';
import { appendRecord, archiveActive, listArchives, readRecords, recordsToMessages, restoreArchive } from './memory-store.js';
import type { ArchiveSummary, ClearResult, MemoryRecord } from './memory-store.type.js';

/** Valid chat roles for a stored message. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** The roles a turn is actually persisted under (`summary` is written by V4/05, not through add). */
type PersistableRole = 'user' | 'assistant' | 'tool';

interface AddOptions {
  /** Tool name for a `tool` result message (serialized as Ollama's `tool_name`). */
  readonly toolName?: string;
  /** Structured tool calls for an assistant turn that issued them. */
  readonly toolCalls?: ToolCall[];
  /**
   * EXACT Ollama counts for the turn that produced this record — `prompt_eval_count`→`prompt`,
   * `eval_count`→`completion`. Omitted (⇒ null/null) for user and tool turns, which no generation
   * produced. NEVER a length-based estimate (constitution: token counts are always exact).
   */
  readonly tokens?: { readonly prompt: number | null; readonly completion: number | null };
}

export class SessionMemory {
  // Per-phase records held in RAM (ALL records, including summaries + replaced ones, so the
  // sequential id stays == file line count). The live Message view filters/converts on read.
  private readonly records = new Map<string, MemoryRecord[]>();
  private active: string | null = null;

  constructor(private readonly projectPath: string) {}

  /** Point at a phase's history, LAZILY loading it from disk the first time it is activated. */
  activatePhase(name: string): void {
    this.active = name;
    if (!this.records.has(name)) {
      this.records.set(name, readRecords(this.projectPath, name));
    }
  }

  /** Append a message to the ACTIVE phase's history — both the RAM array AND its `<phase>.jsonl`. */
  add(role: PersistableRole, content: string, opts?: AddOptions): void {
    const phase = this.requireActive();
    const records = this.records.get(phase) ?? [];
    const record: MemoryRecord = {
      id: String(records.length + 1), // per-file sequential id (inbox/blocker convention; no ULID)
      ts: new Date().toISOString(),
      role,
      content,
      tokens: opts?.tokens ?? { prompt: null, completion: null },
      ...(opts?.toolName !== undefined ? { tool_name: opts.toolName } : {}),
      ...(opts?.toolCalls && opts.toolCalls.length > 0 ? { tool_calls: opts.toolCalls } : {}),
    };
    records.push(record);
    this.records.set(phase, records);
    appendRecord(this.projectPath, phase, record);
  }

  /** `/clear`: archive the active phase's file, then reset its in-RAM history to empty. */
  clearActive(): ClearResult {
    const phase = this.requireActive();
    const archived = archiveActive(this.projectPath, phase);
    this.records.set(phase, []);
    return { phase, archived };
  }

  /** The last `limit` archives for the active phase, most recent first (summaries from JSONL only). */
  archivesForActive(limit: number): ArchiveSummary[] {
    return listArchives(this.projectPath, this.requireActive(), limit);
  }

  /** `/resume`: restore one archive to the active file, then reload the in-RAM view from disk. */
  restoreActive(basename: string): void {
    const phase = this.requireActive();
    restoreArchive(this.projectPath, phase, basename);
    this.records.set(phase, readRecords(this.projectPath, phase));
  }

  /** The active phase's live message array (replaced turns dropped; empty if no phase is active). */
  get history(): Message[] {
    if (this.active === null) return [];
    return recordsToMessages(this.records.get(this.active) ?? []);
  }

  private requireActive(): string {
    if (this.active === null) {
      throw new Error('No active phase set');
    }
    return this.active;
  }
}
