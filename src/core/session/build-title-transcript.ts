// Render a context's opening turns for the TITLE writer, bounded from the HEAD.
//
// The head specifically, not truncateHeadTail, which is this repo's default instrument everywhere
// else: a title says WHY a context exists, and that is established by how the conversation opened.
// Its tail is where the work got to, which is a different question.
//
// Named buildTitleTranscript because summarizer.ts declared its own `buildTranscript` with a
// DIFFERENT body -- unbounded, because a summary must see everything it collapses. Two functions,
// one name, in one folder; both now say which throwaway context they feed.

import type { MemoryRecord } from './memory-record.type.js';
import { capTitle } from './cap-title.js';
import { renderTurn } from './render-turn.js';

/**
 * Hard capTitle, in characters, on the transcript handed to the title writer.
 *
 * The normal path needs nothing like this — a title is written straight after a context's FIRST prose
 * answer, so the transcript is one exchange. The reopen path is why it exists: `titleAttempted` resets
 * when a context is reopened (memory.ts), so an untitled context brought back by `/resume` is titled
 * from its ENTIRE replayed history, which can be most of a full window. That is what would otherwise
 * overflow this role's smaller ceiling and have Ollama silently drop the front of it.
 *
 * 6 000 characters is roughly 1 540 tokens at the ~3.9 chars/token this repo's prose measures at,
 * which with the ~350-token prompt file leaves the call an order of magnitude inside its 8 192 ceiling
 * — room for rules/prompts/context-title.md to grow without this needing to be revisited.
 */
export const TRANSCRIPT_BUDGET = 6000;

/** Told to the model whenever the budget bit, so it knows it is reading a prefix rather than the whole. */
export const TRUNCATION_NOTICE = '\n\n(transcript truncated — this is the opening of the conversation)';

/**
 * Render the context's turns for the title writer (same shape the summarizer's transcript uses),
 * bounded to TRANSCRIPT_BUDGET characters from the HEAD.
 *
 * The head, specifically — not `truncateHeadTail`, which is this repo's default instrument everywhere
 * else. A title says WHY a context exists, and that is established by how the conversation opened; its
 * tail is where the work got to, which is a different question. Cutting whole turns rather than
 * characters keeps every turn the model does see intact, so it never reasons from half a message.
 */
export function buildTitleTranscript(records: readonly MemoryRecord[]): string {
  const rendered = records.map(renderTurn);
  const kept: string[] = [];
  let used = 0;
  for (const turn of rendered) {
    const cost = kept.length === 0 ? turn.length : turn.length + 2; // + the '\n\n' this turn joins on
    if (used + cost > TRANSCRIPT_BUDGET) break;
    kept.push(turn);
    used += cost;
  }
  // An opening turn larger than the whole budget still has to yield something to title: take its head
  // rather than hand over an empty transcript and get an invented title back.
  const body = kept.length > 0 ? kept.join('\n\n') : (rendered[0] ?? '').slice(0, TRANSCRIPT_BUDGET);
  const notice = kept.length < rendered.length ? TRUNCATION_NOTICE : '';
  return `Write the title for this conversation:\n\n${body}${notice}`;
}
