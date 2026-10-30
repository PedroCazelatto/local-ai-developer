// The ONLY write on the hot path, and it performs no read.
//
// The caller buffers turns in RAM and calls this once per assistant turn, so a turn costs ONE
// transaction and NEVER a SELECT — `seq` is assigned in RAM and the context id is held there too. The
// trade-off, stated plainly: a kill mid-turn loses the turn still buffered, where fsync-per-row JSONL
// lost at most a torn line. `synchronous = FULL` still fsyncs every commit.

import type { DatabaseSync } from 'node:sqlite';

import { inTransaction } from './in-transaction.js';
import { insertContext } from './insert-context.js';
import { INSERT_MESSAGE } from './insert-message-sql.js';
import type { MemoryRecord } from './memory-record.type.js';
import { messageInsertParams } from './message-insert-params.js';

/** One row of the flush payload plus the context it belongs to — see flushContext. */
export interface FlushRequest {
  /** The context to append to, or null to create one first (a context is born on its first flush). */
  readonly contextId: string | null;
  readonly phase: string;
  /** The EXACT OLLAMA_NUM_CTX this context is written under; stamped only when creating. */
  readonly numCtx: number;
  readonly records: readonly MemoryRecord[];
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
  // inTransaction: BEGIN / COMMIT, rolling back on any throw so a partial flush is never committed.
  return inTransaction(db, () => {
    // insertContext: creates the row and returns the UUID SQLite generated via RETURNING.
    const contextId = request.contextId ?? insertContext(db, request.phase, request.numCtx);
    const insert = db.prepare(INSERT_MESSAGE);
    for (const record of request.records) {
      // messageInsertParams: binds the record to INSERT_MESSAGE's parameters, in order.
      insert.run(...messageInsertParams(contextId, record));
    }
    return contextId;
  });
}
