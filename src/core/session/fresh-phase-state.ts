// One phase's live state, and how it starts.
//
// WHICH CONTEXT IS LIVE IS SESSION STATE, NOT DATA. Nothing in the database says "this one is current";
// the live context per phase lives in a map on SessionMemory and dies with the process. Every boot
// therefore starts a phase on a FRESH context and reaches an older one only when the user reopens it
// (docs/mental-model.md).
//
// Named freshPhaseState rather than the module-private `freshState` it was extracted from, which names
// no particular state standing alone in a flat folder.

import type { MemoryRecord } from './memory-record.type.js';

/** One phase's live state: its context, every turn in RAM, and what has yet to reach the database. */
export interface PhaseState {
  /** The live context's UUID, or null before its first flush has created the row. */
  contextId: string | null;
  /** Every turn in RAM — collapsed ones included, so `seq` never repeats within a context. */
  records: MemoryRecord[];
  /** Turns added since the last flush, in order. */
  pending: MemoryRecord[];
  /** The `seq` the next turn will take (1-based). */
  nextSeq: number;
  /** The live context's title, or null while it has none. */
  title: string | null;
  /** Whether a title has already been attempted for this context — one try per context per session. */
  titleAttempted: boolean;
}

/** A phase's state on first use: no context row yet, nothing buffered, numbering from 1. */
export function freshPhaseState(): PhaseState {
  return { contextId: null, records: [], pending: [], nextSeq: 1, title: null, titleAttempted: false };
}
