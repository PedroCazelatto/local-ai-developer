// Late-batch eviction — the missing middle between "keep every tool result forever" and "summarize the
// whole history". It replaces older tool results with a one-line stub, costs no inference at all, and is
// the ONLY bound the Worker's window has ever had.
//
// WHY "LATE" IS THE WHOLE DESIGN, and it was measured rather than assumed. Ollama reuses the KV cache
// for the COMMON PREFIX of two consecutive calls on the same model. Appending preserves that prefix;
// rewriting an earlier message destroys it from the edit point onward, and everything after has to be
// prompt-evaluated again. Measured on this project's settings (num_ctx 16384, an ~11.6k-token window,
// counts read from Ollama's own response fields):
//
//   append a message                          prompt_eval_duration  0.39s (14b)   3.32s (32b)
//   stub the NEWEST tool result               prompt_eval_duration  0.22s (14b)
//   stub the OLDEST tool result              prompt_eval_duration 12.38s (14b)  31.26s (32b)
//   resend either mutated prompt unchanged    prompt_eval_duration  0.07s (14b)
//
// Two things follow, and they are the reason this file exists in the shape it does. First, the penalty
// is ONE-TIME — the mutated prefix is cached immediately afterwards — so eviction is not the recurring
// tax it was feared to be. Second, the cost is a pure function of HOW EARLY the earliest rewritten
// message is: at the tail it is cheaper than a plain append, at the head it is a full re-evaluation.
//
// Hence the invariant this file enforces: NEVER REWRITE A MESSAGE EARLIER THAN THE NEWEST SURVIVING
// HALF OF THE WINDOW. A pass that would have to reach into the head does nothing at all and waits. That
// is not a heuristic, it is the measurement expressed as a rule.
//
// WHAT IT BUYS, stated honestly so nobody expects the wrong thing: HEADROOM, not wall clock. With the
// cache warm a turn's prompt evaluation is a fraction of a second whether the window is 9.8k tokens or
// 11.7k, so eviction never makes a turn faster. It buys room to keep working, once, for a fixed price.
//
// THE LIMITATION, equally honest: a window whose bulk sits in its FIRST half cannot be helped by this.
// The pass will correctly decline and the window will keep growing until Ollama silently drops its
// oldest tokens. That residual is a different problem and has its own file —
// backlog/spawned-windows-have-no-failsafe.md.
//
// LIVE-VIEW ONLY, and Worker-scoped. The Worker's window is RAM-only, so a stub is simply a rewritten
// entry in its array and there is nothing durable to reconcile. NOTE FOR WHOEVER EXTENDS THIS TO THE
// INTERACTIVE PHASES: their history is persisted, and the decision taken here was that eviction does NOT
// gain a third hidden state next to `replaced_by` and `cancelled_at` — so a persisted context reopened
// with `/resume` would come back LARGER than the window that was running, and re-evict on its own
// schedule. That is consistent with "nothing is ever deleted", but it is surprising the first time and
// is the thing to write into docs/mental-model.md when that half is built.

import type { Message, ToolCall } from '../llm/index.js';
import type { EvictionRewrite } from './evict-stale-tool-results.type.js';
import { formatEvictedStub } from './format-evicted-stub.js';
import { isEvictableTool } from './is-evictable-tool.js';

/**
 * How many of the newest tool results always survive verbatim.
 *
 * A COUNT, deliberately, and not a token budget. A budget over tool output that has not been evaluated
 * yet could only be computed from string length, and a length-based token figure is exactly what the
 * constitution forbids — estimates drift and they are the wrong basis for a VRAM-safety decision. A
 * count of messages is exact by construction, and predictable to reason about besides.
 */
export const KEEP_RECENT_TOOL_RESULTS = 3;

/**
 * The fewest tool results a pass will rewrite. Below this it does nothing and lets more accumulate.
 *
 * This is the "batch" half of late-batch eviction, and it is not a micro-optimization. The prefix from
 * the earliest rewritten message is re-evaluated ONCE per pass whatever that pass reclaimed, so one
 * rewrite that frees a lot beats five that each free a little — five passes pay the re-evaluation five
 * times. Without this floor a window sitting just over the threshold would rewrite a single result every
 * turn, never reclaim enough to drop back under, and pay the cost again on the next turn.
 *
 * A COUNT again, for the same reason as KEEP_RECENT_TOOL_RESULTS: the only way to express "reclaims
 * enough" in tokens would be to measure un-evaluated text by its length, and a length-derived token
 * figure is exactly what the constitution forbids.
 */
export const MIN_BATCH_TOOL_RESULTS = 2;

/**
 * Decide which tool results to stub in `messages`. Returns the rewrites in ascending index order, or an
 * EMPTY array when the pass declines — which is the normal, expected outcome whenever acting would mean
 * reaching into the head of the window.
 *
 * Pure: it reads the array and decides. The caller applies the rewrites, so this whole policy is
 * callable from a throwaway script with no model, no window and no I/O.
 */
export function evictStaleToolResults(messages: readonly Message[]): readonly EvictionRewrite[] {
  // The invariant, and the only line that enforces it. Index 0 is the system prompt, so for any window
  // worth evicting from this floor also puts the phase instructions permanently out of reach.
  const floor = Math.ceil(messages.length / 2);
  const tailStart = protectedTailStart(messages);
  // Which assistant tool_call produced which tool result. The result message itself carries only
  // `tool_name`, never the arguments, so the path/command the stub names has to come from the pairing.
  const argsByIndex = toolCallArgsByIndex(messages);

  const rewrites: EvictionRewrite[] = [];
  for (let index = floor; index < tailStart; index += 1) {
    const message = messages[index];
    if (message === undefined || message.role !== 'tool') continue;
    const toolName = message.tool_name;
    // isEvictableTool: default-deny — stub what the window LEARNED, never what it DID, and never a tool
    // this codebase has not explicitly cleared. See is-evictable-tool.ts for the rule itself.
    if (toolName === undefined || !isEvictableTool(toolName)) continue;
    const args = argsByIndex.get(index);
    // No assistant tool_call to name this result — a cancelled turn can leave one behind. A stub that
    // could not say WHICH call it stood for would be worse than the text it replaced, so leave it alone.
    if (args === undefined) continue;
    const content = formatEvictedStub(toolName, args);
    // Already stubbed: the pass runs before every model call once scheduled, and re-writing identical
    // text would report a rewrite that did not happen — and, worse, name a prefix boundary that was
    // never crossed. Comparing the content is what makes the pass idempotent, with no marker field.
    if (content === message.content) continue;
    rewrites.push({ index, content });
  }
  // The batch floor. One or two results in the band is not worth a prompt re-evaluation, and acting on
  // it would leave the window still over its threshold and do the same thing again next turn — the
  // "five rewrites that each reclaim a little" this design exists to avoid. Wait instead: the floor
  // advances as the window grows, so the band fills up on its own.
  return rewrites.length < MIN_BATCH_TOOL_RESULTS ? [] : rewrites;
}

/**
 * The index at which the protected tail begins — the KEEP_RECENT_TOOL_RESULTS-th tool result counting
 * back from the end. Returns 0 when the window holds fewer than that many, which empties the band and
 * makes the pass decline: a window with almost no tool results has nothing worth reclaiming anyway.
 */
function protectedTailStart(messages: readonly Message[]): number {
  let seen = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'tool') continue;
    seen += 1;
    if (seen === KEEP_RECENT_TOOL_RESULTS) return index;
  }
  return 0;
}

/**
 * Pair each `tool` message with the arguments of the call that produced it.
 *
 * The turn loop stores one assistant turn carrying `tool_calls`, then pushes one `tool` message per call
 * in the same order, so the k-th result after an assistant turn belongs to its k-th call. A turn cut
 * mid-dispatch leaves fewer results than calls; the next assistant turn simply resets the pairing, and
 * any result that finds no call is left out of the map rather than matched to a neighbour's arguments.
 */
function toolCallArgsByIndex(messages: readonly Message[]): Map<number, Record<string, unknown>> {
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
