// Render the selected turns for the SUMMARIZER, unbounded: a summary that did not see everything it
// claims to collapse would silently drop history the phase can never get back.
//
// Named buildSummaryTranscript because generate-context-title.ts declared its own `buildTranscript`
// with a DIFFERENT body -- head-bounded, because a title only needs the opening.

import type { MemoryRecord } from './memory-record.type.js';
import { renderTurn } from './render-turn.js';

/** Render the selected turns as a readable transcript for the summarizer (roles + tool context kept). */
export function buildSummaryTranscript(records: readonly MemoryRecord[]): string {
  // renderTurn: one turn as `[role]` + content + any tool calls — shared with the context-title writer,
  // so both throwaway contexts read a transcript in exactly the same shape.
  return `Summarize this earlier transcript slice:\n\n${records.map(renderTurn).join('\n\n')}`;
}
