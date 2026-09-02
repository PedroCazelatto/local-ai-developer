// Spawn a fresh Worker window and run it to completion. The window is discarded when this resolves.
//
// WorkerResult is declared below, folded in from the retired worker-result.type.ts. It is part of the
// Worker window's contract with the orchestrator (V2/01), and it is a RESULT rather than a seam: the
// `return` on the last line of this function is the only place in the tree a WorkerResult is
// constructed, so the function that builds it owns it (constitution.md). Contrast WorkerDeps beside
// it, which stays a standalone module precisely because the CALLER constructs that one.

import type { Task } from './task.type.js';
import type { WorkerDeps } from './worker-deps.type.js';
import { WORKER_MAX_ROUNDS } from './worker-window.js';
import { WorkerWindow } from './worker-window.js';
import { buildWorkerSeed } from './build-worker-seed.js';
import { processMessage } from './process-message.js';

/** What one Worker window produces: its final summary + its last test/build run (for the Reviewer). */
export interface WorkerResult {
  /** The Worker's final no-tool-call turn — files touched, tests added, assumptions. */
  readonly summary: string;
  /**
   * The Worker's LAST run_in_project invocation (command + output tail), so V2/02 can seed the
   * Reviewer with the test results; null if the Worker ran none. The Reviewer may re-run regardless.
   */
  readonly lastTestRun: string | null;
}

/**
 * Spawn a fresh Worker window for `task`, run it to completion (streaming to the REPL, all tool
 * calls audited), and return its summary. The window is discarded when this resolves.
 */
export async function runWorkerTask(deps: WorkerDeps, task: Task, specSlice: string): Promise<WorkerResult> {
  const window = new WorkerWindow(deps);
  await processMessage(window, buildWorkerSeed(task, specSlice), WORKER_MAX_ROUNDS);
  return { summary: window.summary, lastTestRun: window.lastTestRun };
}
