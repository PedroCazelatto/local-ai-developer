// The V4/05 summarization failsafe: collapse the oldest half of the active phase's history into one
// `summary` turn, written by a throwaway window. Nothing is deleted -- the collapsed turns stay on
// disk and only leave the VISIBLE view.

import type { Message } from 'ollama';

import type { CompactDeps } from './compact-deps.type.js';
import type { CompactResult } from './compact-result.type.js';
import type { OllamaClient } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import { buildSummaryTranscript } from './build-summary-transcript.js';
import { oneShot } from '../llm/one-shot.js';
import { selectOldest } from './select-oldest.js';
import { SUMMARY_SYSTEM_PROMPT } from './summary-system-prompt.js';

/**
 * Compact the memory's ACTIVE phase: summarize its oldest ~50% of visible turns into one `summary`
 * record. Synchronous with the caller (no background thread — no parallelism, CLAUDE.md). The active
 * phase is the one whose next call is imminent, so `memory` is already pointed at it.
 */
export async function compactActivePhase(deps: CompactDeps): Promise<CompactResult | null> {
  const selected = selectOldest(deps.memory.activeVisibleRecords());
  if (selected.length === 0) return null; // nothing meaningful to compact (defensive; threshold guards this)

  // The slice + system prompt live ONLY inside this throwaway call and are discarded — never appended
  // to the phase's persisted history (same rule as search_rules, V4/02). oneShot returns EXACT tokens.
  const messages: Message[] = [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    { role: 'user', content: buildSummaryTranscript(selected) },
  ];
  // 'summarize' deliberately resolves to the BASE ceiling, not a bounded one: the slice above is the
  // oldest ~50% of a history that has just crossed the threshold, so a smaller window would make Ollama
  // drop the front of it and the failsafe would corrupt the very turns it exists to preserve.
  const { content, tokens } = await oneShot(deps.llm, messages, 'summarize');

  // Append the `summary` turn: it collapses every selected turn (addressed by `seq`, which is stable
  // whether or not the turn has reached the database yet) and carries THIS throwaway call's exact
  // counts (null if Ollama omitted a metric — never a length estimate). `model` is the model that
  // wrote the summary, recorded like any other generated turn.
  deps.memory.appendSummary(
    content.trim(),
    selected.map((record) => record.seq),
    { prompt: tokens.promptTokens, completion: tokens.evalTokens },
    deps.llm.model,
  );
  return { replaced: selected.length, tokens };
}
