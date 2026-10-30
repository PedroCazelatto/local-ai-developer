// Bind one buffered record to INSERT_MESSAGE's parameters, in order.
//
// `cancelled_at` is written on the INSERT rather than stamped by a follow-up UPDATE: a turn cancelled
// while it was still buffered has never been on disk, so it should arrive already hidden instead of
// appearing in the live history for the width of one transaction.
//
// Named messageInsertParams rather than the module-private `messageParams` it was extracted from --
// the name has to say which statement it binds to, standing alone in a flat folder.

import type { SQLInputValue } from 'node:sqlite';

import type { MemoryRecord } from './memory-record.type.js';

/** Bind one buffered record to INSERT_MESSAGE's parameters, in order. */
export function messageInsertParams(contextId: string, record: MemoryRecord): SQLInputValue[] {
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
    record.cancelledAt ?? null,
    record.ts,
    record.ts,
  ];
}
