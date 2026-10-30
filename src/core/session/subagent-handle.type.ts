// The sub-agent contract the ToolContext exposes — one unowned type, in its own file. Three files name
// it and only one of them is in this directory: subagents.ts, where SubagentManager IMPLEMENTS it, and
// tools/create-tool-context.ts + tools/tool-context.type.ts, which depend on it. A class implementing
// an interface is satisfying a contract, not owning it, and folding this into subagents.ts would point
// src/tools at the manager module — whose own imports reach back into src/tools — for a type that
// exists precisely so the three sub-agent tools never see the manager's internals.
//
// The three types its methods name are separate modules for the same reason: this file imports nothing
// from subagents.ts, so nothing that depends on the contract depends on the implementation.

import type { SubagentAskOutcome } from './subagent-ask-outcome.type.js';
import type { SubagentInfo } from './subagent-info.type.js';
import type { SubagentSpawnResult } from './subagent-spawn-result.type.js';

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
