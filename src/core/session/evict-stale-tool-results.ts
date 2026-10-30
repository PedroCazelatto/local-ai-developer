// Evict stale tool results from a window's history to reclaim context, replacing each with a stub
// that records what was called. The recent tail is protected; nothing the model is still using goes.

import type { Message, ToolCall } from 'ollama';

import { formatEvictedStub } from './format-evicted-stub.js';
import { isEvictableTool } from './is-evictable-tool.js';
import { protectedTailStart } from './protected-tail-start.js';
import { toolCallArgsByIndex } from './tool-call-args-by-index.js';

/**
 * One tool result the pass decided to replace, addressed by its position in the window's message array.
 *
 * The pass returns rewrites rather than a new array so it stays PURE: it decides, the window applies.
 * That is also what keeps the whole policy callable from a throwaway script with no Ollama and no
 * WorkerWindow (CLAUDE.md: verify by driving the specific function directly).
 *
 * `index` is load-bearing beyond the write itself: the LOWEST index in a batch is the exact point from
 * which Ollama must re-evaluate the prompt, so it is the number that explains what the pass cost.
 */
export interface EvictionRewrite {
  /** Position in the window's `messages` array. Always a `tool` message. */
  readonly index: number;
  /** The stub that replaces the result's text (format-evicted-stub.ts). */
  readonly content: string;
}

/**
 * The fewest tool results a pass will rewrite. Below this it does nothing and lets more accumulate.
 *
 * This is the "batch" half of late-batch eviction, and it is not a micro-optimization. The prefix from
 * the earliest rewritten message is re-evaluated ONCE per pass whatever that pass reclaimed, so one
 * rewrite that frees a lot beats five that each free a little — five passes pay the re-evaluation five
 * times over.
 *
 * WHY TWO, SPECIFICALLY, AND WHY IT MUST NOT BE TUNED TO 1. This is not a round number picked for
 * caution: the value exists because the band-holds-exactly-one case was hit while verifying the pass,
 * on an ordinary window. That case is a trap rather than a small inefficiency. Rewriting one result
 * reclaims too little to bring the prompt back under EVICTION_THRESHOLD_RATIO, so the window is still
 * over it on the next turn, schedules another pass, finds the one result the advancing floor just
 * uncovered, and rewrites again — paying a re-evaluation every single turn to free a trickle. At 1 this
 * constant does not soften that behaviour, it IS that behaviour. Two is the smallest value that makes a
 * pass wait for something worth paying for.
 *
 * A COUNT again, for the same reason as KEEP_RECENT_TOOL_RESULTS: the only way to express "reclaims
 * enough" in tokens would be to measure un-evaluated text by its length, and a length-derived token
 * figure is exactly what the constitution forbids. Raising it is safe and merely makes passes rarer and
 * larger; lowering it to 1 reintroduces the defect it was added to close.
 */
export const MIN_BATCH_TOOL_RESULTS = 2;

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
