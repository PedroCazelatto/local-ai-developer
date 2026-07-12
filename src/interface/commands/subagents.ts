// /subagents (V5/01) — list the live sub-agents the session has spawned: short id, age, message
// count, and the EXACT cumulative token total (prompt + eval) so the user can see when one is getting
// expensive. A user command, never a model tool (the model spawns/asks/dismisses via its own tools) —
// hence it lives here in interface/commands/, not in src/tools/. Read-only: it only reports.

import type { SubagentInfo } from '../../core/session/index.js';
import * as renderer from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';

/** The slice of the orchestrator /subagents needs — satisfied structurally by SessionOrchestrator. */
export interface SubagentsOrchestrator {
  // listSubagents: a snapshot of every live sub-agent (id, createdAt, message count, exact tokens).
  listSubagents(): SubagentInfo[];
}

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Human age from a createdAt (ms epoch) to now: `4s`, `1m 4s`, `1h 2m`. */
function ageSince(createdAt: number): string {
  const totalSec = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}m ${totalSec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

/** `12 msgs` / `1 msg` — small pluralization for the message count. */
function msgLabel(count: number): string {
  return `${count} ${count === 1 ? 'msg' : 'msgs'}`;
}

/**
 * The EXACT cumulative token total (prompt + eval). A null on either metric (Ollama omitted it on some
 * turn) is surfaced as `unreported` rather than papered over with a 0 or a guess (constitution: token
 * counts are always exact; surface a missing one explicitly).
 */
function tokenLabel(info: SubagentInfo): string {
  const { promptTokens, evalTokens } = info;
  if (promptTokens === null || evalTokens === null) {
    return 'tokens: unreported';
  }
  const fmt = (n: number): string => n.toLocaleString('en-US');
  return `${fmt(promptTokens + evalTokens)} tokens (${fmt(promptTokens)} prompt + ${fmt(evalTokens)} eval)`;
}

export function subagentsCommand(orch: SubagentsOrchestrator): void {
  const agents = orch.listSubagents();
  if (agents.length === 0) {
    renderer.systemMessage('No active sub-agents.');
    return;
  }
  write('');
  write(theme.strong(`Active sub-agents (${agents.length}):`));
  write('');
  for (const a of agents) {
    write(
      `  ${theme.strong(`[sub:${a.shortId}]`)} · ${ageSince(a.createdAt)} · ${msgLabel(a.messageCount)} · ${tokenLabel(a)}`,
    );
  }
  write('');
}
