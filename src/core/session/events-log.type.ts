// Types for the orchestrator EVENTS log (V5/04). Kept in a sibling `.type.ts` per the constitution.
// The events log is a SIBLING of the tool-audit log under projects/<active>/.orchestrator/: the audit
// log records the MODEL's tool calls, this records the HARNESS's own structural actions the user can't
// otherwise see or replay — swapping phases, loading a phase's persisted memory, firing the
// summarization failsafe, evicting tool results from a window, spawning/dismissing a sub-agent,
// switching model. Append-only, never loaded into any prompt (a replay/audit artifact, exactly like the
// audit log).
//
// "Harness", not "orchestrator", because `eviction_fire` is written by a SPAWNED window (the Worker)
// rather than by SessionOrchestrator. That is the one widening this log has taken: the distinction that
// matters is model-action vs. harness-action, and a Worker rewriting its own history is as structural as
// a phase swap. Its `phase` field carries the spawned window's name ("worker"), like any other row.
//
// `context_title` records the throwaway call that titled a phase context: the title it produced and the
// EXACT tokens it cost. That call belongs to no phase's history, so this log is the only place its cost
// is ever surfaced — search_rules records its own one-shot the same way, in the audit log.
//
// `debate` records one deliberation loop the model asked for (the `debate` tool): its rounds, whether the
// challenger conceded, the verdict — or the reason there was none — and the exact summed cost of every
// throwaway call it made. Same reasoning as `context_title`: those calls belong to no phase's history.
//
// `turn_cancelled` records a turn the user stopped (or the stall watchdog abandoned) and how many turns
// left the live history with it. This is the ONLY forward-facing trace of a cancelled exchange: the turns
// themselves are branched off the window, so without this row a session would show a gap in `seq` and
// nothing that explains it. It is also where the cost lands — the GPU time a cancelled turn spent is
// real and is not refunded by hiding the turn.

// `eviction_fire` records one late-batch eviction pass: how many tool results were stubbed, the index it
// rewrote from — which IS the point Ollama re-evaluates the prompt from, so it is what explains the
// pause the user just watched — and the exact prompt sizes either side. `after` cannot be known when the
// pass runs (the new prompt has not been evaluated yet), so it is deferred to the NEXT turn's real
// prompt_eval_count exactly as `summarization_fire` defers its own; a computed figure would be an
// estimate, which the constitution forbids for token counts.

/** The structural actions worth recording. Phase terminology only — never "persona"/"role". */
export type OrchestratorEventType =
  | 'phase_swap'
  | 'memory_load'
  | 'summarization_fire'
  | 'eviction_fire'
  | 'context_title'
  | 'debate'
  | 'subagent_spawn'
  | 'subagent_dismiss'
  | 'model_use'
  | 'turn_cancelled';

/**
 * One events-log line. Any token figure here is the EXACT Ollama count (constitution: never a
 * length-based estimate); a genuinely-absent count is surfaced by OMITTING the field (and, for
 * before/after pairs, a `detail.incomplete` flag), never papered over with a guess or a zero.
 */
export interface OrchestratorEvent {
  /** UTC ISO-8601 ms, stamped by appendEvent at write time. */
  readonly ts: string;
  readonly type: OrchestratorEventType;
  /** Active phase when the event fired ("" if none applies). For sub-agent events, the master phase. */
  readonly phase: string;
  /** Present for sub-agent events — the id whose lineage the row traces back to. */
  readonly subagentId?: string;
  /** Type-specific fields, e.g. `{ from: "discovery", to: "design" }` or `{ before, after }`. */
  readonly detail: Record<string, string | number | boolean>;
  /** Exact prompt_eval_count carried by the event (e.g. a restored/initial figure), when it has one. */
  readonly promptTokens?: number;
  /** Exact eval_count carried by the event, when it has one. */
  readonly evalTokens?: number;
}

/** The caller-supplied fields — everything except `ts`, which appendEvent stamps at write time. */
export type OrchestratorEventInput = Omit<OrchestratorEvent, 'ts'>;
