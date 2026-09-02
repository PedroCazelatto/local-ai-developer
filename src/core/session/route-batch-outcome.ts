// Route one task's terminal outcome into the batch's summary buckets.
//
// EVERY non-pass stashes whatever is LEFT in the tree, so the tree is clean for the next task. The
// Worker never reuses that stash -- a fresh Worker redoes the task from scratch -- it exists for Retro
// to read (blocked) or the user to inspect (escalated, cancelled).
//
// A non-pass can still have COMMITTED work, because the Reviewer accepts files partially, which is why
// `commits` rides on every bucket rather than only on the passed one.
//
// Named routeBatchOutcome rather than the module-private `routeOutcome` it was extracted from.

import type { BatchBlocked } from './batch-blocked.type.js';
import type { BatchCancelled } from './batch-cancelled.type.js';
import type { BatchEscalated } from './batch-escalated.type.js';
import type { BatchPassed } from './batch-passed.type.js';
import type { TaskLoopResult } from './run-task-loop.js';
import { stashTaskAttempt } from './stash-task-attempt.js';

/**
 * Route one task's terminal outcome into the summary buckets. A non-pass stashes whatever is LEFT in
 * the tree so it is clean for the next task — the Worker never reuses the stash (a fresh Worker redoes
 * the task), it exists for Retro (blocked) / inspection (escalated). Note a non-pass can still have
 * committed work: the Reviewer accepts files partially, so `commits` is carried on every bucket.
 */
export function routeBatchOutcome(
  projectPath: string,
  result: TaskLoopResult,
  buckets: {
    passed: BatchPassed[];
    escalated: BatchEscalated[];
    blocked: BatchBlocked[];
    cancelled: BatchCancelled[];
  },
): void {
  // A commit with no sha (git reported none) contributes nothing to report — drop it rather than
  // invent a placeholder the user could mistake for a real ref.
  const commits = result.commits.map((commit) => commit.sha).filter((sha): sha is string => sha !== null);

  if (result.outcome === 'passed') {
    buckets.passed.push({ taskId: result.taskId, commits, rounds: result.rounds });
    return;
  }
  if (result.outcome === 'blocked') {
    const stashRef = stashTaskAttempt(projectPath, result.taskId);
    buckets.blocked.push({
      taskId: result.taskId,
      blockerId: result.blockerId ?? null,
      question: result.question ?? '',
      commits,
      stashRef,
    });
    return;
  }
  if (result.outcome === 'cancelled') {
    // Stashed like every other non-pass: an interrupted attempt is exactly the kind of work worth keeping
    // for inspection, and the tree has to be clean either way for whatever runs next.
    const stashRef = stashTaskAttempt(projectPath, result.taskId);
    buckets.cancelled.push({
      taskId: result.taskId,
      rounds: result.rounds,
      reason: result.cancelReason ?? 'cancelled.',
      commits,
      stashRef,
    });
    return;
  }
  // escalated — 5 rounds with no pass (or an empty diff / no verdict).
  const stashRef = stashTaskAttempt(projectPath, result.taskId);
  buckets.escalated.push({
    taskId: result.taskId,
    rounds: result.rounds,
    lastFeedback: result.lastFeedback ?? '',
    commits,
    stashRef,
  });
}
