// Choose the oldest half of a phase's visible turns -- what the summarization failsafe collapses.
// Oldest, because the recent turns are the ones the phase is still reasoning from.

import type { MemoryRecord } from './memory-record.type.js';

/**
 * The OLDEST ~50% of the visible turns to collapse. Cut at floor(len/2), then extend the cut FORWARD
 * past any leading `tool` survivor so the surviving view never BEGINS with an orphaned tool result
 * (whose matching assistant tool-call would otherwise sit inside the summary) — that would break the
 * chat template on replay. Always leaves at least the newest turn standing; empty when there are
 * fewer than two visible turns (nothing worth compacting).
 */
export function selectOldest(visible: readonly MemoryRecord[]): MemoryRecord[] {
  if (visible.length < 2) return [];
  let cut = Math.floor(visible.length / 2);
  while (cut < visible.length - 1 && visible[cut]?.role === 'tool') cut += 1;
  return visible.slice(0, cut);
}
