// Read ONE persisted batch summary back off disk, narrowed to a real BatchSummary so the existing
// end-of-batch renderer can re-print it exactly as it printed the night it ran.
//
// The file is our own pretty JSON, but JSON.parse hands back an untyped value, so it is narrowed
// field by field rather than asserted (constitution: never `any`, and never an `as` where the shape
// is checkable). That narrowing is to-batch-summary.ts and the read-batch-*.ts files beside it. A
// file that does not narrow returns null and the caller says so in one recoverable line — the same
// choice the stores make when a row will not parse, except that here there is exactly one record and
// dropping it silently would leave the user staring at an empty report.
//
// Only the fields the renderer reads are required. The token counts keep their nulls: a batch whose
// model omitted a metric persisted null, and coercing that to 0 here would invent a count the
// constitution forbids inventing.

import { readFileSync } from 'node:fs';

import type { BatchSummary } from '../../core/session/index.js';
import { toBatchSummary } from './to-batch-summary.js'; // narrow the parsed JSON, or undefined

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
