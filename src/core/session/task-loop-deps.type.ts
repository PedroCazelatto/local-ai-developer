// The infrastructure seam runTaskLoop is bound to — one unowned type, in its own file because a
// dependency seam is not owned by the function that consumes it (constitution.md). runTaskLoop only
// ever READS these fields and forwards the whole object on (to `new WorkerWindow(deps)` and to
// runReviewerTask); the one place a TaskLoopDeps is CONSTRUCTED is SessionOrchestrator.runTaskLoop,
// which builds the literal inline from the session's own llm / sandbox / project / config state. So
// the caller implements it and the type is a contract between two files, belonging to neither — the
// same reading that already put its structural twin BatchDeps in its own module beside runBatch, and
// TaskLoopReporter in its own beside this one.
//
// Worth stating because it is the trap this file exists to close: COUNTING IMPORTERS CANNOT TELL A
// SEAM FROM A RESULT, and on this pair it points the wrong way outright. Until this module existed,
// NOTHING imported the name TaskLoopDeps — the barrel re-exported it and no file consumed that,
// because the literal that builds one is contextually typed and so names nothing at all. Its sibling
// result type TaskLoopResult, which does fold into run-task-loop.ts, is named by eleven files. A
// head-count would have folded the seam and split the result, exactly backwards. The test is which
// side of the call constructs the value, never how many files mention the name.

import type { SandboxClient } from '../container/index.js';
import type { OllamaClient } from '../llm/index.js';
import type { RunStopSignal } from './run-stop-signal.js';

/** The session infrastructure the loop binds a Worker/Reviewer window to (supplied by the orchestrator). */
export interface TaskLoopDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
  /**
   * From SessionConfig — the fraction of num_ctx at which the persistent Worker window starts stubbing
   * its older tool results (worker-window.ts). Carried here because TaskLoopDeps is what the loop hands
   * straight to `new WorkerWindow(...)`, so WorkerDeps' own fields have to be satisfiable from it.
   */
  readonly evictionThresholdRatio: number;
  /** The `/stop` wind-down request, read between rounds. See run-stop-signal.ts. */
  readonly stop: RunStopSignal;
}
