// The index where the protected tail begins: the most recent tool results are never evicted, because
// they are what the model is reasoning from right now.

import type { Message, ToolCall } from 'ollama';

import { KEEP_RECENT_TOOL_RESULTS } from './evict-stale-tool-results.js';

/**
 * The index at which the protected tail begins — the KEEP_RECENT_TOOL_RESULTS-th tool result counting
 * back from the end. Returns 0 when the window holds fewer than that many, which empties the band and
 * makes the pass decline: a window with almost no tool results has nothing worth reclaiming anyway.
 */
export function protectedTailStart(messages: readonly Message[]): number {
  let seen = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'tool') continue;
    seen += 1;
    if (seen === KEEP_RECENT_TOOL_RESULTS) return index;
  }
  return 0;
}
