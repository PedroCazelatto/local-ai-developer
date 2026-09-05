// Spawn a fresh Worker window and run it to completion. The window is discarded when this resolves.

import type { Task } from './task.type.js';
import type { WorkerDeps } from './worker-deps.type.js';
import type { WorkerResult } from './worker-result.type.js';
import { WORKER_MAX_ROUNDS } from './worker-window.js';
import { WorkerWindow } from './worker-window.js';
import { buildWorkerSeed } from './build-worker-seed.js';
import { processMessage } from './process-message.js';

/**
 * Spawn a fresh Worker window for `task`, run it to completion (streaming to the REPL, all tool
 * calls audited), and return its summary. The window is discarded when this resolves.
 */
export async function runWorkerTask(deps: WorkerDeps, task: Task, specSlice: string): Promise<WorkerResult> {
  const window = new WorkerWindow(deps);
  await processMessage(window, buildWorkerSeed(task, specSlice), WORKER_MAX_ROUNDS);
  return { summary: window.summary, lastTestRun: window.lastTestRun };
}
