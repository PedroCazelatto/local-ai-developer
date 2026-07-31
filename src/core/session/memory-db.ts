// Phase-memory storage: the SQLite layer under projects/<active>/.orchestrator/memory.db. Replaces the
// per-phase JSONL files + archive/ directory — a context is now a row that can be listed, titled and
// reopened, instead of a filename that had to be renamed to change state.
//
// A cohesive store module (like inbox-store.ts / blocker-store.ts / app-state.ts): a few tightly-related
// readers/writers over one store, not one function per file. SessionMemory (memory.ts) is the only
// consumer — it owns the in-RAM history and delegates every database touch here.
//
// WRITE SHAPE: the caller buffers turns in RAM and calls flushContext once per assistant turn, so a
// turn costs ONE transaction and NEVER a read — `seq` is assigned in RAM and the context id is held
// there too, so nothing on the hot path needs a SELECT. Reads happen only when a user lists or reopens
// a context. The trade-off this buys, stated plainly: a kill mid-turn loses the turn still buffered,
// where fsync-per-row JSONL lost at most a torn line. `synchronous = FULL` still fsyncs every commit.

import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue, SQLOutputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import type { ToolCall } from '../llm/index.js';
import { MEMORY_PRAGMAS, MEMORY_SCHEMA } from './memory-db.schema.js';
import type { ContextSummary, MemoryRecord, MemoryRole } from './memory-db.type.js';

/** How many leading UUID characters address a context in the UI and to the model (`design/7a888b1f`). */
export const CONTEXT_SHORT_ID_LEN = 8;

/** One row of the flush payload plus the context it belongs to — see flushContext. */
export interface FlushRequest {
  /** The context to append to, or null to create one first (a context is born on its first flush). */
  readonly contextId: string | null;
  readonly phase: string;
  /** The EXACT OLLAMA_NUM_CTX this context is written under; stamped only when creating. */
  readonly numCtx: number;
  readonly records: readonly MemoryRecord[];
}

/** projects/<active>/.orchestrator/memory.db — one database per project, beside its other stores. */
function databaseFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'memory.db');
}

/**
 * Open (creating on first use) a project's memory database with the pragmas and schema applied. The
 * caller holds the handle for the session's lifetime; SQLite is opened synchronously, matching every
 * other store here. Pragmas are per-CONNECTION, so they are re-applied on every open — foreign_keys in
 * particular, which SQLite leaves OFF by default.
 */
export function openMemoryDb(projectPath: string): DatabaseSync {
  mkdirSync(path.dirname(databaseFile(projectPath)), { recursive: true });
  const db = new DatabaseSync(databaseFile(projectPath));
  db.exec(MEMORY_PRAGMAS);
  db.exec(MEMORY_SCHEMA);
  return db;
}

/** Read one column as text, or '' when the value is absent/non-text (defensive; the schema forbids it). */
function asText(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Read one column as text or null — for the genuinely nullable columns (`title`, `model`, `tool_name`). */
function asTextOrNull(value: SQLOutputValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Read one column as an integer, preserving NULL. SQLite hands back `bigint` for values outside the
 * safe-integer range, so both are accepted; a null stays null and is NEVER coerced to 0 — the
 * difference between "0 tokens" and "Ollama reported none" is the whole basis of the exact-token
 * invariant (constitution).
 */
function asIntOrNull(value: SQLOutputValue | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return null;
}

/** Read one column as an integer, treating NULL as 0 — for COUNT/SUM aggregates only, never for tokens. */
function asInt(value: SQLOutputValue | undefined): number {
  return asIntOrNull(value) ?? 0;
}

/** Narrow a parsed JSON value to Ollama's ToolCall[] — the DB is hand-inspectable AND machine-fed. */
function isToolCallArray(value: unknown): value is ToolCall[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const fn = (entry as { function?: unknown }).function;
      if (typeof fn !== 'object' || fn === null) return false;
      return typeof (fn as { name?: unknown }).name === 'string';
    })
  );
}

/** Rebuild the `tool_calls` column into ToolCall[]; undefined when absent or unparseable (never throws). */
function parseToolCalls(value: SQLOutputValue | undefined): ToolCall[] | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return isToolCallArray(parsed) ? parsed : undefined;
  } catch {
    // A hand-edited or truncated value must not sink a reopen — the turn replays without its calls.
    return undefined;
  }
}

/** Narrow the stored role; an unknown value cannot reach here (CHECK constraint) but must not throw. */
function asRole(value: SQLOutputValue | undefined): MemoryRole {
  const role = asText(value);
  return role === 'assistant' || role === 'tool' || role === 'summary' ? role : 'user';
}

/** Rebuild one `messages` row into the in-RAM MemoryRecord shape. */
function toRecord(row: Record<string, SQLOutputValue>): MemoryRecord {
  const model = asTextOrNull(row['model']);
  const toolName = asTextOrNull(row['tool_name']);
  const toolCalls = parseToolCalls(row['tool_calls']);
  return {
    seq: asInt(row['seq']),
    ts: asText(row['created_at']),
    role: asRole(row['role']),
    content: asText(row['content']),
    tokens: { prompt: asIntOrNull(row['prompt_tokens']), completion: asIntOrNull(row['completion_tokens']) },
    ...(model !== null ? { model } : {}),
    ...(toolName !== null ? { tool_name: toolName } : {}),
    ...(toolCalls !== undefined ? { tool_calls: toolCalls } : {}),
  };
}

/** Run `work` inside one transaction, rolling back on any throw so a partial flush is never committed. */
function inTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Create a context row and return the UUID SQLITE generated for it. The id comes back via RETURNING
 * rather than being computed here on purpose: the column DEFAULT is then the single source of ids, so a
 * row inserted by hand at a sqlite3 prompt is identified the same way this one is.
 */
function insertContext(db: DatabaseSync, phase: string, numCtx: number): string {
  const row = db.prepare('INSERT INTO contexts (phase, num_ctx) VALUES (?, ?) RETURNING id').get(phase, numCtx);
  const id = asText(row?.['id']);
  if (id === '') {
    throw new Error(`memory.db: creating a context for phase '${phase}' returned no id`);
  }
  return id;
}

/** The insert every flush uses. `created_at` is passed EXPLICITLY — see flushContext. */
const INSERT_MESSAGE =
  'INSERT INTO messages (context_id, seq, role, content, model, tool_name, tool_calls, ' +
  'prompt_tokens, completion_tokens, created_at, updated_at) ' +
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

/** Bind one buffered record to INSERT_MESSAGE's parameters, in order. */
function messageParams(contextId: string, record: MemoryRecord): SQLInputValue[] {
  return [
    contextId,
    record.seq,
    record.role,
    record.content,
    record.model ?? null,
    record.tool_name ?? null,
    record.tool_calls !== undefined && record.tool_calls.length > 0 ? JSON.stringify(record.tool_calls) : null,
    record.tokens.prompt,
    record.tokens.completion,
    record.ts,
    record.ts,
  ];
}

/**
 * Append every buffered turn in ONE transaction, creating the context first when this is its first
 * flush, and return the context's id. The only write on the hot path, and it performs no read.
 *
 * `created_at` is passed explicitly instead of leaning on the column DEFAULT because a flush LAGS the
 * turns it carries — a user message buffered while the model generates for 30s would otherwise be
 * stamped with the flush time and appear to have been typed after the reply it caused. The DEFAULT
 * stays in the schema as the value any hand-written insert gets.
 */
export function flushContext(db: DatabaseSync, request: FlushRequest): string {
  return inTransaction(db, () => {
    const contextId = request.contextId ?? insertContext(db, request.phase, request.numCtx);
    const insert = db.prepare(INSERT_MESSAGE);
    for (const record of request.records) {
      insert.run(...messageParams(contextId, record));
    }
    return contextId;
  });
}

/**
 * Write the summary turn that collapses `replacedSeqs`, in one transaction: insert the `summary` row,
 * read back the UUID SQLite gave it, then point every collapsed turn's `replaced_by` at it. The
 * originals are never deleted — only hidden from the visible view — so a collapse stays inspectable
 * after the fact.
 */
export function collapseIntoSummary(
  db: DatabaseSync,
  contextId: string,
  summary: MemoryRecord,
  replacedSeqs: readonly number[],
): void {
  inTransaction(db, () => {
    const row = db.prepare(`${INSERT_MESSAGE} RETURNING id`).get(...messageParams(contextId, summary));
    const summaryId = asText(row?.['id']);
    if (summaryId === '') {
      throw new Error(`memory.db: inserting a summary into context '${contextId}' returned no id`);
    }
    const mark = db.prepare('UPDATE messages SET replaced_by = ? WHERE context_id = ? AND seq = ?');
    for (const seq of replacedSeqs) {
      mark.run(summaryId, contextId, seq);
    }
  });
}

/** Give a context its title. Called once per context, after its first prose answer. */
export function setContextTitle(db: DatabaseSync, contextId: string, title: string): void {
  db.prepare('UPDATE contexts SET title = ? WHERE id = ?').run(title, contextId);
}

/**
 * A context's CURRENTLY-VISIBLE turns in order — turns a summary has collapsed are excluded by the
 * `replaced_by IS NULL` predicate, so the collapse walk that used to run in JS is now the query. This
 * is what a reopen replays into the phase's prompt.
 */
export function readVisibleMessages(db: DatabaseSync, contextId: string): MemoryRecord[] {
  const rows = db
    .prepare(
      'SELECT seq, role, content, model, tool_name, tool_calls, prompt_tokens, completion_tokens, created_at ' +
        'FROM messages WHERE context_id = ? AND replaced_by IS NULL ORDER BY seq',
    )
    .all(contextId);
  return rows.map(toRecord);
}

/**
 * The highest `seq` used in a context, INCLUDING turns a summary has collapsed — 0 for an empty
 * context. A reopen needs this rather than the visible count: reusing a collapsed turn's seq would
 * collide with `UNIQUE (context_id, seq)` and abort the next flush.
 */
export function maxSeq(db: DatabaseSync, contextId: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(seq), 0) AS top FROM messages WHERE context_id = ?').get(contextId);
  return asInt(row?.['top']);
}

// Every listing figure is DERIVED here rather than stored, so no counter can drift from the turns it
// counts. Turn count and token total cover the VISIBLE turns only (the join is filtered), so the two
// agree with each other and with what a reopen would actually replay. `models` is comma-joined by
// group_concat — model names cannot contain a comma — and its order is unspecified.
const LIST_SELECT = `
  SELECT c.id, c.phase, c.title, c.created_at,
         COUNT(m.seq) AS turns,
         COALESCE(SUM(m.prompt_tokens), 0) + COALESCE(SUM(m.completion_tokens), 0) AS tokens,
         COALESCE(MAX(m.created_at), c.created_at) AS last_at,
         group_concat(DISTINCT m.model) AS models
  FROM contexts c
  LEFT JOIN messages m ON m.context_id = c.id AND m.replaced_by IS NULL
`;

/** Rebuild one listing row into a ContextSummary. */
function toSummary(row: Record<string, SQLOutputValue>): ContextSummary {
  const models = asTextOrNull(row['models']);
  return {
    id: asText(row['id']),
    phase: asText(row['phase']),
    title: asTextOrNull(row['title']),
    createdAt: asText(row['created_at']),
    lastActivityAt: asText(row['last_at']),
    turnCount: asInt(row['turns']),
    totalTokens: asInt(row['tokens']),
    models: models === null || models === '' ? [] : models.split(','),
  };
}

/**
 * The last `limit` contexts of one phase, MOST RECENTLY ACTIVE FIRST, excluding `excludeId` (the live
 * context — reopening the one you are already in is a no-op).
 *
 * Contexts written under a DIFFERENT `num_ctx` are omitted, never deleted: Ollama silently discards the
 * oldest tokens past the ceiling, so replaying a history built under a larger window would leave the
 * phase reasoning from turns it can no longer see. Restoring the old OLLAMA_NUM_CTX brings them back.
 */
export function listContexts(
  db: DatabaseSync,
  phase: string,
  numCtx: number,
  limit: number,
  excludeId: string | null,
): ContextSummary[] {
  const rows = db
    .prepare(
      `${LIST_SELECT} WHERE c.phase = ? AND c.num_ctx = ? AND c.id IS NOT ? ` +
        'GROUP BY c.id ORDER BY last_at DESC LIMIT ?',
    )
    .all(phase, numCtx, excludeId, limit);
  return rows.map(toSummary);
}

/** One context by id, or null when no row carries it (a hand-deleted row, or an id that never existed). */
export function readContextSummary(db: DatabaseSync, contextId: string): ContextSummary | null {
  const row = db.prepare(`${LIST_SELECT} WHERE c.id = ? GROUP BY c.id`).get(contextId);
  return row === undefined ? null : toSummary(row);
}

/** The address form the UI and the model use for a context — its leading UUID characters. */
export function shortContextId(contextId: string): string {
  return contextId.slice(0, CONTEXT_SHORT_ID_LEN);
}

/**
 * Resolve a user- or model-supplied address to exactly one context of `phase`: a full UUID or any
 * unique leading prefix of one (`design/7a888b1f`). Ambiguous or unknown input resolves to null, so a
 * caller never acts on a guess. Restricted to the phase's own contexts and to the current `num_ctx`,
 * so an address cannot reach a context the listing refuses to show.
 */
export function resolveContextId(db: DatabaseSync, phase: string, numCtx: number, address: string): string | null {
  const wanted = address.trim().toLowerCase();
  if (wanted === '') return null;
  const rows = db
    .prepare("SELECT id FROM contexts WHERE phase = ? AND num_ctx = ? AND id LIKE ? || '%'")
    .all(phase, numCtx, wanted);
  return rows.length === 1 ? asText(rows[0]?.['id']) : null;
}
