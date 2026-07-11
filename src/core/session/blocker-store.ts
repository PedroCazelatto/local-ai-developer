// Blocker store (V3/02) — append-only JSONL at projects/<active>/.orchestrator/blockers.jsonl, the
// same discipline as the tool audit log (audit.ts): one JSON line per event, fsync'd per row so a
// kill mid-write leaves a partial LAST line at worst. It is durable session state (git-ignored
// alongside the audit log), NOT project history. Open-vs-resolved is derived by REPLAY, never mutated
// in place: a `raised` row with no matching `resolved` row (by id) is open.
//
// This is a cohesive store module (like backlog.ts): a few tightly-related readers/writers over one
// file, not one function per file.

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';

import type { BlockerRow, RaisedBlocker, ResolvedBlocker } from './blocker-store.type.js';

/** Absolute path to the project's blockers.jsonl (session state under .orchestrator/). */
function blockersFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'blockers.jsonl');
}

/** Append one row, creating .orchestrator/ on first write and fsync'ing before close (as audit.ts). */
function appendRow(projectPath: string, row: BlockerRow): void {
  const dir = path.join(projectPath, '.orchestrator');
  mkdirSync(dir, { recursive: true });
  const line = `${JSON.stringify(row)}\n`;
  const fd = openSync(path.join(dir, 'blockers.jsonl'), 'a');
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Read + parse every row; a malformed line is skipped (a torn last line must not sink replay). */
export function readBlockerRows(projectPath: string): BlockerRow[] {
  const file = blockersFile(projectPath);
  if (!existsSync(file)) return [];
  const rows: BlockerRow[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isBlockerRow(parsed)) rows.push(parsed);
    } catch {
      // A partial/torn line (e.g. a kill mid-write) — skip it, keep replaying the intact rows.
    }
  }
  return rows;
}

/** Narrow a parsed JSON value to a BlockerRow (defensive — the file is hand-inspectable + machine-fed). */
function isBlockerRow(value: unknown): value is BlockerRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'raised') {
    return typeof row['id'] === 'string' && typeof row['taskId'] === 'string' && typeof row['question'] === 'string';
  }
  if (row['kind'] === 'resolved') {
    return typeof row['id'] === 'string' && typeof row['answer'] === 'string';
  }
  return false;
}

/**
 * Record a blocker the Reviewer raised: derive the per-task 1-based id `${taskId}#${n}` by replaying
 * how many `raised` rows this task already has, stamp UTC now, append the row, and return it. No
 * parallelism (CLAUDE.md), so the count-then-append is race-free.
 */
export function raiseBlocker(
  projectPath: string,
  input: { readonly taskId: string; readonly round: number; readonly question: string },
): RaisedBlocker {
  const priorForTask = readBlockerRows(projectPath).filter(
    (row) => row.kind === 'raised' && row.taskId === input.taskId,
  ).length;
  const raised: RaisedBlocker = {
    id: `${input.taskId}#${priorForTask + 1}`,
    taskId: input.taskId,
    round: input.round,
    question: input.question,
    raisedAt: new Date().toISOString(),
  };
  appendRow(projectPath, { kind: 'raised', ...raised });
  return raised;
}

/** Record the user's answer to a raised blocker: stamp UTC now, append the `resolved` row, return it. */
export function resolveBlocker(
  projectPath: string,
  input: { readonly id: string; readonly answer: string },
): ResolvedBlocker {
  const resolved: ResolvedBlocker = { id: input.id, answer: input.answer, resolvedAt: new Date().toISOString() };
  appendRow(projectPath, { kind: 'resolved', ...resolved });
  return resolved;
}

/**
 * The OPEN blocker for a task, or undefined — a `raised` row whose id has no matching `resolved` row.
 * A task holds at most one open blocker at a time (it can't be re-blocked until it is re-run, and it
 * is only re-run after being answered), so returning the latest-raised open one is unambiguous.
 */
export function openBlockerForTask(projectPath: string, taskId: string): RaisedBlocker | undefined {
  const rows = readBlockerRows(projectPath);
  const resolvedIds = new Set(rows.filter((row) => row.kind === 'resolved').map((row) => row.id));
  const open = rows.filter(
    (row): row is { kind: 'raised' } & RaisedBlocker =>
      row.kind === 'raised' && row.taskId === taskId && !resolvedIds.has(row.id),
  );
  return open.length === 0 ? undefined : open[open.length - 1];
}
