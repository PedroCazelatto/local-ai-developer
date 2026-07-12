// Sub-agent types (V5/01). The in-memory state of one sub-agent, the deps the manager needs to run
// its turns, and the small public contract the ToolContext exposes to the three sub-agent tools. A
// sub-agent is the CLAUDE.md "core mental model" made concrete: a fresh, empty messages array against
// the same local Ollama, briefed by the master phase and discarded at session end — never persisted.

import type { SandboxClient } from '../container/index.js';
import type { Message, OllamaClient, Tool } from '../llm/index.js';

/**
 * One live sub-agent's in-memory state (dies with the session — no JSONL, unlike per-phase memory).
 * `promptTokens`/`evalTokens` are the EXACT cumulative Ollama counts across all of this sub-agent's
 * turns (a `null` on any turn poisons the running sum — constitution: never a length-based estimate).
 */
export interface SubagentState {
  readonly id: string;
  /** Model it was created with — kept for its whole life even if the session model later changes (V5/02). */
  readonly model: string;
  readonly numCtx: number;
  /** Its OWN isolated history: the system brief + the task + every turn since. Never the master's history. */
  readonly messages: Message[];
  /** The master's tool set MINUS the three sub-agent tools — no nested sub-agents (verified by construction). */
  readonly toolDefs: Tool[];
  /** The phase that spawned it — stamped as `phase` on every audit row for this sub-agent's tool calls. */
  readonly masterPhase: string;
  /** Date.now() ms at spawn — drives the age shown by `/subagents`. */
  readonly createdAt: number;
  /** EXACT cumulative prompt_eval_count; null once any turn failed to report it (never estimated). */
  promptTokens: number | null;
  /** EXACT cumulative eval_count; null once any turn failed to report it. */
  evalTokens: number | null;
}

/** Everything the SubagentManager needs to run + audit sub-agent turns against the session's one model. */
export interface SubagentDeps {
  readonly llm: OllamaClient;
  /** The FULL registry tool set (toolDefinitions()); the manager filters out the three sub-agent tools. */
  readonly tools: Tool[];
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
  /** Session model + num_ctx, recorded on each SubagentState (same model — no per-sub-agent config). */
  readonly model: string;
  readonly numCtx: number;
}

/** A read-only snapshot of one sub-agent for `/subagents` and the status-line count. */
export interface SubagentInfo {
  readonly id: string;
  /** First few chars of `id` — the form shown in the `[sub:<short>]` history marker. */
  readonly shortId: string;
  readonly createdAt: number;
  /** Messages in its history (system brief + task + turns) — a cheap proxy for how far it has run. */
  readonly messageCount: number;
  /** EXACT cumulative counts; null means Ollama did not report the metric on some turn (surfaced, not guessed). */
  readonly promptTokens: number | null;
  readonly evalTokens: number | null;
}

/** spawn_subagent's result: the new id + the sub-agent's first answer, in one round-trip. */
export interface SubagentSpawnResult {
  readonly id: string;
  readonly response: string;
}

/**
 * ask_subagent's outcome: `found` carries the answer; `!found` lets the tool build the recoverable
 * `unknown_subagent` error (the id was dismissed or never existed) — the turn is never killed.
 */
export type SubagentAskOutcome =
  | { readonly found: true; readonly response: string }
  | { readonly found: false };

/**
 * The tool-facing contract the ToolContext exposes; SubagentManager implements it. Kept minimal so the
 * three tools stay decoupled from the manager's internals (dependency inversion).
 */
export interface SubagentHandle {
  /** Count of live sub-agents — the status-line `Subagents: N` figure. */
  readonly count: number;
  /** Spawn a fresh sub-agent for the given master phase; run its first turn; return { id, response }. */
  spawn(masterPhase: string, initialContext: string, task: string): Promise<SubagentSpawnResult>;
  /** Follow up with an existing sub-agent; { found:false } when the id is unknown/dismissed. */
  ask(id: string, message: string): Promise<SubagentAskOutcome>;
  /** Drop a sub-agent's state. Idempotent — an unknown/already-dismissed id still returns { ok: true }. */
  dismiss(id: string): { readonly ok: boolean };
  /** Snapshot of every live sub-agent, for `/subagents`. */
  list(): SubagentInfo[];
}
