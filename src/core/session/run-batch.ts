// The V3/05 unattended batch driver -- "kick off a batch and walk away." It walks the selected backlog
// tasks STRICTLY SEQUENTIALLY (no parallelism -- a 3060 holds one window at a time; a hard constraint,
// not a perf choice), routing each task's V3/01 loop outcome without a human in the inner loop.
//
// A blocker or an escalation is a PER-TASK result, never a batch failure: the whole value of an
// overnight run is that one ambiguous task doesn't waste the other eleven hours. The batch aborts ONLY
// on a genuine infra fault (Ollama down, sandbox unreachable) or a pre-flight refusal, and even then it
// persists a PARTIAL summary and exits cleanly.
//
// UI is injected via a reporter (dependency inversion) so this stays pure orchestration, and the exact
// per-task token counts are summed into one exact batch total (constitution).

import path from 'node:path';

import type { TokenCounts } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import type { BatchBlocked } from './batch-blocked.type.js';
import type { BatchCancelled } from './batch-cancelled.type.js';
import type { BatchDeps } from './batch-deps.type.js';
import type { BatchEscalated } from './batch-escalated.type.js';
import type { BatchPassed } from './batch-passed.type.js';
import type { BatchPosition } from './batch-position.type.js';
import type { BatchReporter } from './batch-reporter.type.js';
import type { BatchSkipped } from './batch-skipped.type.js';
import type { BatchSummary } from './batch-summary.type.js';
import { findTask } from './find-task.js';
import { isWorkingTreeDirty } from './is-working-tree-dirty.js';
import { nextBatchSeq } from './next-batch-seq.js';
import { persistBatchSummary } from './persist-batch-summary.js';
import { preflightRefusal } from './preflight-refusal.js';
import { readBacklog } from './read-backlog.js';
import { routeBatchOutcome } from './route-batch-outcome.js';
import type { TaskLoopResult } from './run-task-loop.type.js';
import { taskSkipReason } from './task-skip-reason.js';

/**
 * Run the selected task ids as one unattended, strictly-sequential batch. Returns (and persists) a
 * BatchSummary either way — the caller renders it and, for the blocked tasks, tells the user to /answer.
 */
export async function runBatch(
  deps: BatchDeps,
  taskIds: readonly string[],
  reporter: BatchReporter,
): Promise<BatchSummary> {
  const startedAt = new Date().toISOString();
  const passed: BatchPassed[] = [];
  const escalated: BatchEscalated[] = [];
  const blocked: BatchBlocked[] = [];
  const cancelled: BatchCancelled[] = [];
  const skipped: BatchSkipped[] = [];
  let tokens: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  /** Set once the user wound the batch down — a deliberate stop, never reported as an abort. */
  let stoppedReason: string | undefined;

  // Pre-flight (honors the V3/03 systemic-patch pause): never run a batch on top of an unreviewed global
  // instruction change, nor on a dirty project tree (which would mix a stray change into a task's review).
  let abortedReason = preflightRefusal(deps.projectPath);

  const total = taskIds.length;
  for (let i = 0; abortedReason === undefined && i < taskIds.length; i += 1) {
    const id = taskIds[i] ?? '';
    const position: BatchPosition = { index: i + 1, total };

    // `/stop` wind-down: checked at the TASK boundary, so whatever ran before this point kept its full
    // loop — verdict, commits and all — and only the untouched remainder is left for a later run. This is
    // the whole point of the two scopes: winding an overnight batch down must never cost work already done.
    if (deps.stop.stopBeforeNextTask) {
      stoppedReason = `stopped by the user with ${taskIds.length - i} task(s) not started.`;
      break;
    }

    // Reload each iteration — a prior task's commit changes what's runnable now. taskSkipReason: done /
    // blocked-awaiting-answer / unmet-deps / not-found (shared with the single-task /run path).
    const backlog = readBacklog(deps.projectPath);
    const reason = taskSkipReason(backlog, id);
    const task = findTask(backlog, id);
    if (task === undefined || reason !== null) {
      const why = reason ?? 'not found in the backlog.';
      skipped.push({ taskId: id, reason: why });
      reporter.taskSkipped(id, why);
      continue;
    }

    // A passed task commits and a non-pass stashes itself clean, so mid-batch the tree stays clean; a dirty
    // tree here means a stray/external change — skip this one task rather than corrupt its review (keep going).
    if (isWorkingTreeDirty(deps.projectPath)) {
      const why = 'the project working tree is dirty — its review cannot be isolated (skipped).';
      skipped.push({ taskId: id, reason: why });
      reporter.taskSkipped(id, why);
      continue;
    }

    reporter.taskStarted(position, task);

    let result: TaskLoopResult;
    try {
      // runTask: the injected V3/01 loop for ONE task (persistent Worker ≤5 rounds, fresh Reviewer each
      // round, the Reviewer commits what it accepts). A throw here is a genuine infra fault, not a
      // task-level failure.
      result = await deps.runTask(task, position);
    } catch (err) {
      abortedReason = `infrastructure fault on ${id}: ${err instanceof Error ? err.message : String(err)}`;
      break; // record progress so far and exit cleanly with a partial summary
    }

    tokens = addTokenCounts(tokens, result.tokens); // exact sum across every task's loop
    reporter.taskOutcome(result);
    routeBatchOutcome(deps.projectPath, result, { passed, escalated, blocked, cancelled });

    // A cancelled task ends the batch. Ctrl+C cut a model call mid-round, so continuing would start the
    // NEXT task on a box the user just reached for the stop key on — the opposite of what the press meant.
    if (result.outcome === 'cancelled') {
      stoppedReason = `${result.cancelReason ?? 'cancelled.'} ${taskIds.length - i - 1} task(s) not started.`;
      break;
    }
  }

  const summary: BatchSummary = {
    seq: nextBatchSeq(deps.projectPath),
    startedAt,
    finishedAt: new Date().toISOString(),
    total: passed.length + escalated.length + blocked.length + cancelled.length,
    passed,
    escalated,
    blocked,
    cancelled,
    skipped,
    tokens,
    ...(abortedReason !== undefined ? { abortedReason } : {}),
    ...(stoppedReason !== undefined ? { stoppedReason } : {}),
  };
  persistBatchSummary(deps.projectPath, summary);
  reporter.finished(summary);
  return summary;
}
