// Types for the per-phase memory JSONL (V4/04). Kept in a sibling `.type.ts` per the constitution
// (types live beside the module they serve, never inline with a function). The on-disk record shape
// is the durable contract: V4/05's summarization writes the `summary` role + `replaces` into these
// same files, so both fields are declared here even though this task only READS them.

import type { ToolCall } from '../llm/index.js';

/**
 * The role of a stored turn. `user | assistant | tool` are the live conversation; `summary` is
 * written by V4/05's failsafe to collapse older turns — this task's loader must skip the turns a
 * summary `replaces` without crashing on the role itself.
 */
export type MemoryRole = 'user' | 'assistant' | 'tool' | 'summary';

/**
 * One line of a phase's `<phase>.jsonl` — exactly one conversational turn. Append-only: a record is
 * never rewritten in place. `tokens` are the EXACT Ollama counts for the turn that produced this
 * record (`prompt_eval_count`→`prompt`, `eval_count`→`completion`); `null` means the metric was
 * genuinely absent — NEVER a length-based estimate (constitution: token counts are always exact).
 * User and tool turns carry `null`/`null` because no Ollama generation produced them.
 */
export interface MemoryRecord {
  /** Per-file sequential id ("1", "2", …) — the inbox/blocker convention (no ULID dependency). */
  readonly id: string;
  /** ISO-8601 UTC timestamp of when the turn was appended. */
  readonly ts: string;
  readonly role: MemoryRole;
  readonly content: string;
  /** The assistant's issued tool calls, when the turn made any. */
  readonly tool_calls?: ToolCall[];
  /** For `role: "tool"` records, which tool produced the result. */
  readonly tool_name?: string;
  /** Exact per-turn counts, or `null` when Ollama reported none (never estimated). */
  readonly tokens: { readonly prompt: number | null; readonly completion: number | null };
  /** Present only on `role: "summary"` (V4/05): the record ids this summary stands in for. */
  readonly replaces?: string[];
}

/** Outcome of a `/clear`: the phase cleared and the archive it produced (null when it was empty). */
export interface ClearResult {
  readonly phase: string;
  readonly archived: string | null;
}

/**
 * What `activatePhase` reports back so the orchestrator can emit a V5/04 `memory_load` event. A load
 * only counts on a phase's FIRST activation this session (an actual disk read); re-activating a phase
 * already in RAM reads nothing new. `lastPromptTokens` is the most recent persisted prompt_eval_count
 * — the EXACT restored context size — or null if none was ever recorded (never estimated).
 */
export interface PhaseLoad {
  readonly loadedFromDisk: boolean;
  /** Visible messages rebuilt into the prompt on load (0 for a fresh phase with no persisted turns). */
  readonly turns: number;
  readonly lastPromptTokens: number | null;
}

/**
 * A `/resume` listing entry for one archived history, derived DIRECTLY from the JSONL — no LLM call,
 * no cost. `file` is the archive basename to restore; the rest is the human-readable summary line.
 */
export interface ArchiveSummary {
  /** Archive basename, e.g. `worker-20260621T211400123-1.jsonl` — the handle `restoreArchive` takes. */
  readonly file: string;
  /** Epoch ms parsed from the archive filename's compact timestamp — the moment it was archived. */
  readonly archivedAtMs: number;
  /** Number of turns (records) in the archive. */
  readonly turnCount: number;
  /** First user turn's content (untruncated — the caller truncates for display). */
  readonly firstUser: string;
  /** Last user turn's content (untruncated — the caller truncates for display). */
  readonly lastUser: string;
  /** Sum of every record's prompt + completion tokens, treating `null` as 0 (a display total only). */
  readonly totalTokens: number;
}
