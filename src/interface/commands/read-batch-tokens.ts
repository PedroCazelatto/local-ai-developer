// The `tokens` object of a persisted batch summary. Split out of read-batch-summary-file.ts.

import type { TokenCounts } from '../../core/llm/token-counts.type.js';
import { isRecord } from '../../core/llm/is-record.js'; // a non-null, non-array object (never null, never an array)
import { nullableTokenCount } from './nullable-token-count.js'; // a number, or a null that stays null

/** The batch's exact prompt/eval totals, or undefined when the field is not a pair of token counts. */
export function readBatchTokens(raw: unknown): TokenCounts | undefined {
  if (!isRecord(raw)) return undefined;
  const promptTokens = nullableTokenCount(raw['promptTokens']);
  const evalTokens = nullableTokenCount(raw['evalTokens']);
  if (promptTokens === undefined || evalTokens === undefined) return undefined;
  return { promptTokens, evalTokens };
}
