// The two pinned STATUS lines, recomputed from the orchestrator and handed to the status bar. Called
// before every prompt, on every keystroke, and on the ticker while a turn runs.

import { statusBar } from '../core/ui/status-bar.js';
import { theme } from '../core/ui/theme.js';
import { capitalizePhase } from '../core/ui/capitalize-phase.js'; // discovery -> Discovery, for display only
import type { ReplOrchestrator } from './run-repl.js';

/**
 * Repaint the two pinned STATUS lines:
 *   line 1  `Phase: <Name> | Ctx: N%`  — the active phase (Capitalized, in its theme color) and the
 *           context-window fill: the phase's EXACT cumulative tokens as a percent of num_ctx.
 *   line 2  `Model: <model> | Project: <project>`.
 * Ctx is an EXACT count (constitution) shown as `0%` when the phase has no completed turn yet — never
 * a `?%` and never a length-based estimate. `no model` when none is selected, so the line never
 * implies a loaded model when a turn would fail.
 */
export function updateStatus(orch: ReplOrchestrator): void {
  const filled = orch.activePhaseTokenTotal ?? 0;
  const ctxPct = orch.numCtx > 0 ? Math.round((filled / orch.numCtx) * 100) : 0;
  const line1 =
    theme.phase(orch.activePhase)(`Phase: ${capitalizePhase(orch.activePhase)}`) + theme.meta(` | Ctx: ${ctxPct}%`);
  const line2 = theme.meta(`Model: ${orch.model ?? 'no model'} | Project: ${orch.project}`);
  statusBar.setStatus(line1, line2);
}
