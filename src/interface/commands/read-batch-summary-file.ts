// Read ONE persisted batch summary back off disk, narrowed to a real BatchSummary so the existing
// end-of-batch renderer can re-print it exactly as it printed the night it ran.
//
// The file is our own pretty JSON, but JSON.parse hands back an untyped value, so it is narrowed
// field by field rather than asserted (constitution: never `any`, and never an `as` where the shape
// is checkable). A file that does not narrow returns null and the caller says so in one recoverable
// line — the same choice the stores make when a row will not parse, except that here there is exactly
// one record and dropping it silently would leave the user staring at an empty report.
//
// Only the fields the renderer reads are required. The token counts keep their nulls: a batch whose
// model omitted a metric persisted null, and coercing that to 0 here would invent a count the
// constitution forbids inventing.

import { readFileSync } from 'node:fs';

import type {
  BatchBlocked,
  BatchCancelled,
  BatchEscalated,
  BatchPassed,
  BatchSkipped,
  BatchSummary,
} from '../../core/session/index.js';
import type { TokenCounts } from '../../core/llm/index.js';

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(raw: unknown): raw is string {
  return typeof raw === 'string';
}

function isCount(raw: unknown): raw is number {
  return typeof raw === 'number' && Number.isFinite(raw);
}

/** A persisted `commits` list: short SHAs, oldest first. Absent/!array fails the row it belongs to. */
function readCommits(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.every(isText) ? raw : undefined;
}

/** `promptTokens` / `evalTokens` as persisted — a number, or a null that MUST stay null. */
function readTokenCount(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  return isCount(raw) ? raw : undefined;
}

function readTokens(raw: unknown): TokenCounts | undefined {
  if (!isRow(raw)) return undefined;
  const promptTokens = readTokenCount(raw['promptTokens']);
  const evalTokens = readTokenCount(raw['evalTokens']);
  if (promptTokens === undefined || evalTokens === undefined) return undefined;
  return { promptTokens, evalTokens };
}

/** Narrow each element of a persisted bucket, failing the whole summary if any element does not. */
function readBucket<T>(raw: unknown, readOne: (row: Row) => T | undefined): T[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: T[] = [];
  for (const element of raw) {
    if (!isRow(element)) return undefined;
    const one = readOne(element);
    if (one === undefined) return undefined;
    out.push(one);
  }
  return out;
}

function readPassed(row: Row): BatchPassed | undefined {
  const commits = readCommits(row['commits']);
  if (!isText(row['taskId']) || commits === undefined || !isCount(row['rounds'])) return undefined;
  return { taskId: row['taskId'], commits, rounds: row['rounds'] };
}

function readEscalated(row: Row): BatchEscalated | undefined {
  const commits = readCommits(row['commits']);
  const stashRef = row['stashRef'];
  if (!isText(row['taskId']) || !isCount(row['rounds']) || !isText(row['lastFeedback'])) return undefined;
  if (commits === undefined || !(stashRef === null || isText(stashRef))) return undefined;
  return { taskId: row['taskId'], rounds: row['rounds'], lastFeedback: row['lastFeedback'], commits, stashRef };
}

function readBlocked(row: Row): BatchBlocked | undefined {
  const commits = readCommits(row['commits']);
  const blockerId = row['blockerId'];
  const stashRef = row['stashRef'];
  if (!isText(row['taskId']) || !isText(row['question']) || commits === undefined) return undefined;
  if (!(blockerId === null || isText(blockerId)) || !(stashRef === null || isText(stashRef))) return undefined;
  return { taskId: row['taskId'], blockerId, question: row['question'], commits, stashRef };
}

function readCancelled(row: Row): BatchCancelled | undefined {
  const commits = readCommits(row['commits']);
  const stashRef = row['stashRef'];
  if (!isText(row['taskId']) || !isCount(row['rounds']) || !isText(row['reason'])) return undefined;
  if (commits === undefined || !(stashRef === null || isText(stashRef))) return undefined;
  return { taskId: row['taskId'], rounds: row['rounds'], reason: row['reason'], commits, stashRef };
}

function readSkipped(row: Row): BatchSkipped | undefined {
  if (!isText(row['taskId']) || !isText(row['reason'])) return undefined;
  return { taskId: row['taskId'], reason: row['reason'] };
}

/** Narrow a parsed JSON value to a BatchSummary, or undefined when it is not one this build can render. */
function toBatchSummary(value: unknown): BatchSummary | undefined {
  if (!isRow(value)) return undefined;
  const passed = readBucket(value['passed'], readPassed);
  const escalated = readBucket(value['escalated'], readEscalated);
  const blocked = readBucket(value['blocked'], readBlocked);
  const cancelled = readBucket(value['cancelled'], readCancelled);
  const skipped = readBucket(value['skipped'], readSkipped);
  const tokens = readTokens(value['tokens']);
  if (!isCount(value['seq']) || !isCount(value['total'])) return undefined;
  if (!isText(value['startedAt']) || !isText(value['finishedAt'])) return undefined;
  if (passed === undefined || escalated === undefined || blocked === undefined) return undefined;
  if (cancelled === undefined || skipped === undefined || tokens === undefined) return undefined;

  const abortedReason = value['abortedReason'];
  const stoppedReason = value['stoppedReason'];
  return {
    seq: value['seq'],
    startedAt: value['startedAt'],
    finishedAt: value['finishedAt'],
    total: value['total'],
    passed,
    escalated,
    blocked,
    cancelled,
    skipped,
    tokens,
    // Both are optional on the wire and are only present when they happened — carried through as
    // absent rather than as an empty string, so the renderer's "did this happen" check still holds.
    ...(isText(abortedReason) ? { abortedReason } : {}),
    ...(isText(stoppedReason) ? { stoppedReason } : {}),
  };
}

/** The summary persisted at `filePath`, or null when it is unreadable or is not a batch summary. */
export function readBatchSummaryFile(filePath: string): BatchSummary | null {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return toBatchSummary(parsed) ?? null;
  } catch {
    return null; // a torn write (a kill mid-persist) leaves invalid JSON — reported, never guessed at
  }
}
