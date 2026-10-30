// Part of the Reviewer window's contract with the orchestrator (V2/01).

import type { Task } from './task.type.js';

/** What the Reviewer window is told about the Worker's attempt (assembled by V2/02). */
export interface ReviewerInput {
  /** The task under review — same definition + acceptance the Worker was seeded with. */
  readonly task: Task;
  /** The fix-loop round (1..MAX_ROUNDS) being reviewed — stamped onto a raised blocker (V3/02). */
  readonly round: number;
  /** The Worker's plain-text change summary (its final no-tool turn). */
  readonly workerSummary: string;
  /** Changed-files set / diff for the attempt; "" if not captured (Reviewer inspects the tree itself). */
  readonly changedFiles: string;
  /** The test output the Worker produced (stdout/stderr + exit); "" if not captured (Reviewer re-runs). */
  readonly testResults: string;
}
