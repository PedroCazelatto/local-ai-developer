// Per-phase memory JSONL store (V4/04) — the disk layer under
// projects/<active>/.orchestrator/memory/. Same discipline as the audit / blocker / inbox stores:
// append-only, one JSON line per turn, fsync'd per row so a kill mid-write leaves a partial LAST
// line at worst (readRecords skips a torn line). Nothing is ever rewritten in place; `/clear` MOVES
// the active file into archive/, V4/05 APPENDS a `summary` row. Single-process, single active phase
// (CLAUDE.md: no parallelism) ⇒ count-then-append and move-then-move are race-free; no locking.
//
// A cohesive store module (like blocker-store.ts / inbox-store.ts): a few tightly-related
// readers/writers over the memory files, not one function per file. SessionMemory (memory.ts) is the
// only consumer — it owns the in-RAM history and delegates every disk touch here.

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';

import type { Message } from '../llm/index.js';
import type { ArchiveSummary, MemoryRecord, MemoryRole } from './memory-store.type.js';

/** projects/<active>/.orchestrator/memory — the per-phase active files live here. */
function memoryDir(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'memory');
}

/** The active append-only history for one phase, e.g. `.../memory/worker.jsonl`. */
function activeFile(projectPath: string, phase: string): string {
  return path.join(memoryDir(projectPath), `${phase}.jsonl`);
}

/** memory/archive — one dir for ALL phases; every file is prefixed with its `<phase>-`. */
function archiveDir(projectPath: string): string {
  return path.join(memoryDir(projectPath), 'archive');
}

/** Compact, filesystem-safe UTC stamp `YYYYMMDDTHHmmssSSS` (no colons — Windows-first, CLAUDE.md). */
function compactTs(date: Date): string {
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const p3 = (n: number): string => String(n).padStart(3, '0');
  return (
    `${date.getUTCFullYear()}${p2(date.getUTCMonth() + 1)}${p2(date.getUTCDate())}` +
    `T${p2(date.getUTCHours())}${p2(date.getUTCMinutes())}${p2(date.getUTCSeconds())}${p3(date.getUTCMilliseconds())}`
  );
}

/** Inverse of compactTs: parse the stamp out of an archive basename into epoch ms (NaN if malformed). */
function parseCompactTs(stamp: string): number {
  if (stamp.length !== 18 || stamp[8] !== 'T') return Number.NaN;
  const num = (from: number, to: number): number => Number(stamp.slice(from, to));
  return Date.UTC(num(0, 4), num(4, 6) - 1, num(6, 8), num(9, 11), num(11, 13), num(13, 15), num(15, 18));
}

/** Count archives already belonging to `phase` (append-only ⇒ used only for a same-ms tiebreaker). */
function countPhaseArchives(dir: string, phase: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.startsWith(`${phase}-`) && f.endsWith('.jsonl')).length;
}

/**
 * A fresh, collision-free archive basename `<phase>-<compactTs>-<n>.jsonl`. `n` (a sequential index,
 * matching the inbox/blocker id convention) tie-breaks the vanishingly-rare same-ms case; the final
 * existsSync loop makes uniqueness airtight even after a `/resume` swap moved an archive back out.
 */
function newArchiveName(dir: string, phase: string): string {
  const ts = compactTs(new Date());
  let n = countPhaseArchives(dir, phase) + 1;
  let name = `${phase}-${ts}-${n}.jsonl`;
  while (existsSync(path.join(dir, name))) {
    n += 1;
    name = `${phase}-${ts}-${n}.jsonl`;
  }
  return name;
}

/** Append one record as a JSON line, creating memory/ on first write and fsync'ing before close. */
export function appendRecord(projectPath: string, phase: string, record: MemoryRecord): void {
  mkdirSync(memoryDir(projectPath), { recursive: true });
  const line = `${JSON.stringify(record)}\n`;
  const fd = openSync(activeFile(projectPath, phase), 'a');
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Parse every record in a JSONL file; a malformed/torn line is skipped (must not sink replay). */
function parseRecordsFile(fullPath: string): MemoryRecord[] {
  if (!existsSync(fullPath)) return [];
  const records: MemoryRecord[] = [];
  for (const line of readFileSync(fullPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isMemoryRecord(parsed)) records.push(parsed);
    } catch {
      // A partial/torn last line (a kill mid-write) — skip it, keep the intact records.
    }
  }
  return records;
}

/** Read a phase's active `<phase>.jsonl` into records (empty if the file does not exist yet). */
export function readRecords(projectPath: string, phase: string): MemoryRecord[] {
  return parseRecordsFile(activeFile(projectPath, phase));
}

/** Narrow a parsed JSON value to a MemoryRecord (the file is hand-inspectable AND machine-fed). */
function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  const roleOk =
    row['role'] === 'user' || row['role'] === 'assistant' || row['role'] === 'tool' || row['role'] === 'summary';
  const tokens = row['tokens'];
  const tokensOk =
    typeof tokens === 'object' &&
    tokens !== null &&
    'prompt' in tokens &&
    'completion' in tokens;
  return typeof row['id'] === 'string' && typeof row['ts'] === 'string' && roleOk && typeof row['content'] === 'string' && tokensOk;
}

/** Map a stored role to a chat role. `summary` renders as an assistant note in the live view; V4/05
 * owns the final placement — this task only needs it to replay without breaking the chat template. */
function chatRole(role: MemoryRole): Message['role'] {
  return role === 'summary' ? 'assistant' : role;
}

/** Rebuild one record into the Ollama Message shape (mirrors SessionMemory.add's field handling). */
function toMessage(record: MemoryRecord): Message {
  const message: Message = { role: chatRole(record.role), content: record.content };
  if (record.tool_name !== undefined) message.tool_name = record.tool_name;
  if (record.tool_calls !== undefined && record.tool_calls.length > 0) message.tool_calls = record.tool_calls;
  return message;
}

/**
 * The live in-memory view of a phase's records: walk them in order, DROPPING any turn a later
 * `summary` record `replaces` (V4/05's collapse), and convert the survivors to Messages. This task
 * implements the skip walk so V4/05 only has to add the WRITING side.
 */
export function recordsToMessages(records: readonly MemoryRecord[]): Message[] {
  const replaced = new Set<string>();
  for (const record of records) {
    if (record.role === 'summary' && record.replaces !== undefined) {
      for (const id of record.replaces) replaced.add(id);
    }
  }
  const messages: Message[] = [];
  for (const record of records) {
    if (replaced.has(record.id)) continue;
    messages.push(toMessage(record));
  }
  return messages;
}

/**
 * Move a phase's active `<phase>.jsonl` into archive/ under a fresh `<phase>-<ts>-<n>.jsonl`. Returns
 * the archive basename, or null when the phase has no active file yet (nothing to archive). The move
 * is the ONLY mutation — the data is untouched, so the archive is a faithful, restorable snapshot.
 */
export function archiveActive(projectPath: string, phase: string): string | null {
  const active = activeFile(projectPath, phase);
  if (!existsSync(active)) return null;
  const dir = archiveDir(projectPath);
  mkdirSync(dir, { recursive: true });
  const name = newArchiveName(dir, phase);
  renameSync(active, path.join(dir, name));
  return name;
}

/**
 * Restore an archive back to the phase's active file (mirrors archiveActive): first swing the
 * CURRENT active file (likely the empty one created since the last clear) out into a fresh archive so
 * it can be resumed again later, then move the chosen archive into place. Throws if the archive is
 * missing (the caller only passes basenames it just listed, so this is a defensive guard).
 */
export function restoreArchive(projectPath: string, phase: string, basename: string): void {
  const dir = archiveDir(projectPath);
  const chosen = path.join(dir, basename);
  if (!existsSync(chosen)) {
    throw new Error(`archive '${basename}' not found for phase '${phase}'`);
  }
  mkdirSync(memoryDir(projectPath), { recursive: true });
  const active = activeFile(projectPath, phase);
  if (existsSync(active)) {
    renameSync(active, path.join(dir, newArchiveName(dir, phase)));
  }
  renameSync(chosen, active);
}

/** First / last record whose role is `user`, or '' when the archive holds no user turns. */
function firstUser(records: readonly MemoryRecord[]): string {
  return records.find((r) => r.role === 'user')?.content ?? '';
}
function lastUser(records: readonly MemoryRecord[]): string {
  return [...records].reverse().find((r) => r.role === 'user')?.content ?? '';
}

/** Sum every record's prompt + completion tokens, `null`→0 (a rough display size only, per the task). */
function totalTokens(records: readonly MemoryRecord[]): number {
  return records.reduce((sum, r) => sum + (r.tokens.prompt ?? 0) + (r.tokens.completion ?? 0), 0);
}

/**
 * The last `limit` archives for a phase, MOST RECENT FIRST, each summarized straight from its JSONL —
 * no LLM call, no cost (contrast V4/05's throwaway summary call). Sort key is the filename's compact
 * timestamp (falling back to the sequential index for the same-ms tiebreak).
 */
export function listArchives(projectPath: string, phase: string, limit: number): ArchiveSummary[] {
  const dir = archiveDir(projectPath);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.startsWith(`${phase}-`) && f.endsWith('.jsonl'));

  const summaries = files.map((file): ArchiveSummary => {
    const records = parseRecordsFile(path.join(dir, file));
    return {
      file,
      archivedAtMs: parseCompactTs(file.slice(phase.length + 1, phase.length + 19)),
      turnCount: records.length,
      firstUser: firstUser(records),
      lastUser: lastUser(records),
      totalTokens: totalTokens(records),
    };
  });

  // Newest first: compare epoch ms; the sequential index in the name breaks a same-ms tie.
  const indexOf = (file: string): number => Number(file.replace(/\.jsonl$/, '').split('-').pop());
  summaries.sort((a, b) => b.archivedAtMs - a.archivedAtMs || indexOf(b.file) - indexOf(a.file));
  return summaries.slice(0, limit);
}
