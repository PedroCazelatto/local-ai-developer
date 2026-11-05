// The summarization failsafe for a SPAWNED window (backlog item 9): the interactive failsafe's
// instrument — a throwaway `summarize` one-shot over the oldest half — applied to a window's raw
// message array instead of SessionMemory.
//
// Two things differ from compact-active-phase.ts, both decided rather than inherited:
//   - INDEX 0 AND INDEX 1 ARE BOTH PROTECTED (#24a). [1] is the window's SEED — the Worker's task and
//     spec slice, the Reviewer's changed files, Retro's misunderstanding and stashed diff, a debater's
//     claim and material. A window that loses its seed has lost its contract. An interactive phase has
//     no seed, which is the only reason its failsafe protects [0] alone.
//   - THE SUMMARY TAKES THE COLLAPSED MESSAGES' PLACE, right after the seed, as an assistant-role note —
//     so what the model reads stays in order. (The interactive failsafe appends its summary last; that
//     ordering was left alone by its own decision and is not copied here.)

import type { Message } from 'ollama';

import type { OllamaClient } from '../llm/client.js';
import { oneShot } from '../llm/one-shot.js';
import { buildSummaryTranscript } from './build-summary-transcript.js';
import type { CompactResult } from './compact-result.type.js';
import { selectOldest } from './select-oldest.js';
import type { SpawnedTrace } from './spawned-trace.js';
import { SUMMARY_SYSTEM_PROMPT } from './summary-system-prompt.js';

/** The system prompt at [0] and the seed at [1] — never summarized (#24a). */
const PROTECTED_HEAD = 2;

/**
 * Collapse the oldest ~half of `messages` past the protected head into one summary message, in place,
 * and record the collapse in `trace`. Returns null when there was nothing worth compacting. `announce`
 * runs only once there is something to collapse, just before the summarization call the user waits on.
 */
export async function compactSpawnedWindow(
  llm: OllamaClient,
  messages: Message[],
  trace: SpawnedTrace,
  announce: () => void,
): Promise<CompactResult | null> {
  // selectOldest: the oldest half, extended past any leading tool result so the survivors never begin
  // with a result whose tool call was summarized away.
  const selected = selectOldest(messages.slice(PROTECTED_HEAD));
  if (selected.length === 0) return null;
  announce();

  // oneShot: a throwaway call whose turns enter no history. 'summarize' runs at the BASE ceiling — the
  // slice is half a window that has just crossed the threshold, and a smaller one would drop its front.
  const { content, tokens } = await oneShot(
    llm,
    [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      // buildSummaryTranscript: the turns as `[role]` blocks, tool calls spelled out.
      { role: 'user', content: buildSummaryTranscript(selected) },
    ],
    'summarize',
  );
  const summary = content.trim();
  messages.splice(PROTECTED_HEAD, selected.length, { role: 'assistant', content: summary });
  // trace.collapse: a `summary` row the collapsed rows now point at — the originals stay in memory.db.
  trace.collapse(PROTECTED_HEAD, selected.length, summary, { prompt: tokens.promptTokens, completion: tokens.evalTokens }, llm.model);
  return { replaced: selected.length, tokens };
}
