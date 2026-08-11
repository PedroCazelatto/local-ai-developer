// Summarization failsafe (V4/05) — the WRITING side of the summary/`replaces` mechanism V4/04's
// loader already reads. When a phase's history crosses the VRAM threshold (the orchestrator schedules
// it off the EXACT prompt_eval_count — never an estimate), this compacts the ACTIVE phase's oldest
// ~50% of currently-visible turns into a single `summary` record via a THROWAWAY Ollama call (oneShot
// — same model + num_ctx, NOT added to any phase's history). Originals stay on disk (append-only);
// only the in-memory view collapses, via the summary's `replaces` id list. A FAILSAFE, not routine:
// it should fire rarely, only to keep prompt_eval_count under the num_ctx ceiling on the RTX 3060.

import { oneShot } from '../llm/index.js';
import type { Message, OllamaClient, TokenCounts } from '../llm/index.js';
import type { SessionMemory } from './memory.js';
import type { MemoryRecord } from './memory-db.type.js';
import { renderTurn } from './render-turn.js';

// Terse, artifact-preserving compression — the three requirements from the task, verbatim in intent.
const SUMMARY_SYSTEM_PROMPT =
  'You are compressing an EARLIER slice of a coding-agent transcript so the conversation stays under a ' +
  'hard VRAM/context limit. Rewrite the slice into ONE terse summary that PRESERVES concrete artifacts — ' +
  'file paths, function/type/module names, decisions made and their rationale, open questions, TODOs, ' +
  'and any cross-phase inbox items raised — over conversational filler. Do not restate turns verbatim; ' +
  'target a small fraction of the original length. Output ONLY the summary prose, no preamble or headings.';

export interface CompactDeps {
  readonly llm: OllamaClient;
  readonly memory: SessionMemory;
}

/**
 * Outcome of one compaction: how many turns collapsed + the throwaway call's EXACT tokens (for the
 * caller to log if it wishes). `null` when there was nothing to compact (fewer than two visible
 * turns) — which should not happen once the threshold has actually tripped.
 */
export interface CompactResult {
  readonly replaced: number;
  readonly tokens: TokenCounts;
}

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
    { role: 'user', content: buildTranscript(selected) },
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

/**
 * The OLDEST ~50% of the visible turns to collapse. Cut at floor(len/2), then extend the cut FORWARD
 * past any leading `tool` survivor so the surviving view never BEGINS with an orphaned tool result
 * (whose matching assistant tool-call would otherwise sit inside the summary) — that would break the
 * chat template on replay. Always leaves at least the newest turn standing; empty when there are
 * fewer than two visible turns (nothing worth compacting).
 */
function selectOldest(visible: readonly MemoryRecord[]): MemoryRecord[] {
  if (visible.length < 2) return [];
  let cut = Math.floor(visible.length / 2);
  while (cut < visible.length - 1 && visible[cut]?.role === 'tool') cut += 1;
  return visible.slice(0, cut);
}

/** Render the selected turns as a readable transcript for the summarizer (roles + tool context kept). */
function buildTranscript(records: readonly MemoryRecord[]): string {
  // renderTurn: one turn as `[role]` + content + any tool calls — shared with the context-title writer,
  // so both throwaway contexts read a transcript in exactly the same shape.
  return `Summarize this earlier transcript slice:\n\n${records.map(renderTurn).join('\n\n')}`;
}
