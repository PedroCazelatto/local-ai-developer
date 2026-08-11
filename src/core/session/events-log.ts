// Orchestrator events log (V5/04) — appends ONE JSON line per harness-level structural event to
// projects/<active>/.orchestrator/events.jsonl, a SIBLING of the tool-audit log written through the
// SAME appendJsonlLine writer (V1/06 durability). Distinct concerns, never merged: audit = the model's
// tool calls, events = the harness's own actions (phase swap / memory load / summarization fire /
// eviction fire / sub-agent spawn+dismiss / model use). Lives under the ACTIVE PROJECT (per-project
// persistence, CLAUDE.md), never in the orchestrator repo, and is NEVER injected into any phase's prompt.
//
// Most rows come from SessionOrchestrator; `eviction_fire` comes from a spawned Worker window. See
// events-log.type.ts for why that widening is the right line to draw.

import path from 'node:path';

import { appendJsonlLine } from './append-jsonl-line.js';
import type { OrchestratorEventInput } from './events-log.type.js';

/** Append one orchestrator event; stamps `ts` here so every emit site stays terse (like the dispatcher). */
export function appendEvent(projectPath: string, event: OrchestratorEventInput): void {
  const file = path.join(projectPath, '.orchestrator', 'events.jsonl');
  const row: Record<string, unknown> = {
    ts: new Date().toISOString(),
    type: event.type,
    phase: event.phase,
    detail: event.detail,
  };
  // A sub-agent's id / token figures are stamped only when present — never a null placeholder.
  if (event.subagentId !== undefined) row['subagent_id'] = event.subagentId;
  if (event.promptTokens !== undefined) row['prompt_tokens'] = event.promptTokens;
  if (event.evalTokens !== undefined) row['eval_tokens'] = event.evalTokens;
  appendJsonlLine(file, row);
}
