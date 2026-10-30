// The body of /subagents: list the live sub-agents the session has spawned. Split out of
// subagents.ts, which is now the assembler that registers it.
//
// Named showSubagents, NOT listSubagents, and the distinction is load-bearing: that name already
// belongs to SessionOrchestrator's METHOD (and to the SubagentsOrchestrator member below), which
// produces the snapshot. This one prints it — and it matches show-audit.ts, show-batch.ts,
// show-blockers.ts, show-inbox.ts and show-tasks.ts beside it, all of which render a listing.
//
// Read-only: it only reports. The model spawns / asks / dismisses through its own tools.

import type { SubagentInfo } from '../../core/session/subagent-info.type.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import { write } from '../../core/ui/write.js';
import { ageLabel } from './age-label.js';
import { msgLabel } from './msg-label.js';
import { tokenLabel } from './token-label.js';

/** The slice of the orchestrator /subagents needs — satisfied structurally by SessionOrchestrator. */
export interface SubagentsOrchestrator {
  // listSubagents: a snapshot of every live sub-agent (id, createdAt, message count, exact tokens).
  listSubagents(): SubagentInfo[];
}

/** Print one row per live sub-agent — short id, age, message count, exact cumulative tokens. */
export function showSubagents(orch: SubagentsOrchestrator): void {
  const agents = orch.listSubagents();
  if (agents.length === 0) {
    renderer.systemMessage('No active sub-agents.');
    return;
  }
  // write: the raw stdout row a hand-painted table is built out of (deliberately not a renderer line).
  write('');
  write(theme.strong(`Active sub-agents (${agents.length}):`));
  write('');
  for (const a of agents) {
    // ageLabel / msgLabel / tokenLabel: `1m 4s`, `12 msgs`, and the EXACT prompt+eval total — which
    // says `unreported` rather than 0 when Ollama omitted a metric.
    write(
      `  ${theme.strong(`[sub:${a.shortId}]`)} · ${ageLabel(a.createdAt)} · ${msgLabel(a.messageCount)} · ${tokenLabel(a)}`,
    );
  }
  write('');
}
