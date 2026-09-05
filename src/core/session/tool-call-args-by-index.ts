// Map each tool result back to the arguments of the call that produced it, so an evicted result can
// be replaced by a stub that still says WHAT was called and with what.

import type { Message, ToolCall } from '../llm/index.js';

/**
 * Pair each `tool` message with the arguments of the call that produced it.
 *
 * The turn loop stores one assistant turn carrying `tool_calls`, then pushes one `tool` message per call
 * in the same order, so the k-th result after an assistant turn belongs to its k-th call. A turn cut
 * mid-dispatch leaves fewer results than calls; the next assistant turn simply resets the pairing, and
 * any result that finds no call is left out of the map rather than matched to a neighbour's arguments.
 */
export function toolCallArgsByIndex(messages: readonly Message[]): Map<number, Record<string, unknown>> {
  const byIndex = new Map<number, Record<string, unknown>>();
  let pending: ToolCall[] = [];
  let next = 0;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined) continue;
    if (message.role === 'assistant') {
      pending = message.tool_calls ?? [];
      next = 0;
      continue;
    }
    if (message.role !== 'tool') continue;
    const call = pending[next];
    next += 1;
    if (call !== undefined) byIndex.set(index, call.function.arguments);
  }
  return byIndex;
}
