// The RAM half of "still in the phase's live history".
//
// THIS DEFINITION EXISTS TWICE AND THE TWO MUST AGREE: visible-turn-where.ts is the SQL half, applied
// when turns are read back out of memory.db, and this is the JS half, applied to the turns held in RAM
// during a session. They are the same predicate in two languages — a turn no summary has collapsed and
// no cancel has branched off — because the buffered history and the persisted history have to answer
// the question identically or a flush would change what the phase can see. Change one, change both.
//
// Named visibleTurns rather than the module-private `visibleOf` it was extracted from.

import type { MemoryRecord } from './memory-record.type.js';

/** The turns a phase still sees: everything no summary has collapsed and no cancel has branched off. */
export function visibleTurns(records: readonly MemoryRecord[]): MemoryRecord[] {
  return records.filter((record) => record.replacedBySeq === undefined && record.cancelledAt === undefined);
}
