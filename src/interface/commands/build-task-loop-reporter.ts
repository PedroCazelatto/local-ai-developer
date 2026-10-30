// The per-task UI seam runTaskLoop reports progress through. Split out of run.ts, where it was the
// private `buildReporter` — a name that did not say WHICH reporter in a file that built two.
//
// Named for the type it builds, exactly as build-batch-reporter.ts is: TaskLoopReporter here,
// BatchReporter there. The arrows inside are the returned handle's implementation, not declarations
// of their own — the constitution's carve-out for an object a function builds and returns.
//
// This is the dependency inversion the batch driver rests on: runTaskLoop never imports a renderer,
// it reports through whatever seam it is handed.

import type { BatchPosition } from '../../core/session/batch-position.type.js';
import type { TaskLoopReporter } from '../../core/session/task-loop-reporter.type.js';
import type { Task } from '../../core/session/task.type.js';
import { renderer } from '../../core/ui/renderer.js';
import { renderVerdict } from '../render-verdict.js';

/** The per-task UI the loop reports progress through (injected). `position` adds the batch `[N/M]` prefix. */
export function buildTaskLoopReporter(task: Task, position?: BatchPosition): TaskLoopReporter {
  const prefix = position ? `[${position.index}/${position.total}] ${task.id}` : task.id;
  return {
    roundStarted: (round, maxRounds) => renderer.systemMessage(`▶ ${prefix} · round ${round}/${maxRounds}`),
    filesChanged: (status) => renderer.systemMessage(`Files changed:\n${status}`),
    // renderVerdict: PASS/FAIL headline, summary, issues by severity, exact Reviewer tokens (V2/02).
    verdictReady: (verdict, changedCount, tokens) =>
      renderVerdict(verdict, { taskId: task.id, taskTitle: task.title, changedCount, tokens }),
  };
}
