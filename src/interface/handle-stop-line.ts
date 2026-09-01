// Which submitted lines are control instructions rather than messages. Handed to the input fence by
// run-repl.ts, alongside request-cancel.ts, for the same reason: the fence keeps no session knowledge.

import { renderer } from '../core/ui/renderer.js';
import { theme } from '../core/ui/theme.js';
import type { ReplOrchestrator } from './run-repl.js';

/**
 * A `/stop` line typed into the fence while a run is in flight. Claimed HERE rather than queued because
 * the queue drains only when the whole `/run` ends — which is the very thing being asked to stop.
 *
 * Strict about what it claims: only `/stop` and `/stop round`. Anything else falls through to the queue
 * and reaches the command registry, so a typo is reported as an unknown command instead of being
 * swallowed by the fence and quietly arming nothing.
 */
export function handleStopLine(orch: ReplOrchestrator, line: string): boolean {
  if (!orch.runStop.active) return false;
  const words = line.trim().toLowerCase().split(/\s+/);
  if (words[0] !== '/stop') return false;
  if (words.length > 2) return false;
  const arg = words[1];
  if (arg !== undefined && arg !== 'round') return false;

  if (arg === 'round') {
    orch.runStop.request('round');
    renderer.interjectLine(theme.meta('⏸ will stop after this round — the task ends without a verdict'));
    return true;
  }
  orch.runStop.request('task');
  renderer.interjectLine(theme.meta('⏸ will stop after this task — it finishes and commits first'));
  return true;
}
