// Bracket a whole /run with the `/stop` signal armed. Split out of run.ts.

import { dispatchRun } from './dispatch-run.js';
import type { RunOrchestrator } from './run-orchestrator.type.js';

/**
 * Bracket the whole run with the stop signal armed, so `/stop` typed into the fence is claimed for
 * exactly as long as there is something to stop — and cleared afterwards, so a stop asked for during one
 * run can never wind down the next one before it has started.
 */
export async function runWithStopArmed(args: readonly string[], orch: RunOrchestrator): Promise<void> {
  orch.runStop.begin();
  try {
    // dispatchRun: resolves the selector, then runs one task directly or the batch unattended.
    await dispatchRun(args, orch);
  } finally {
    orch.runStop.end();
  }
}
