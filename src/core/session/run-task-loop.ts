// The V3/01 implement→test→review→fix controller — the choke point the rest of V3 hangs off. For
// ONE task it runs a bounded loop: the Worker window is created ONCE and reused across every round
// (its history accumulates each attempt + the Reviewer's feedback, so it converges instead of
// starting blind); the Reviewer gets a FRESH window each round (no cross-round leakage). A `pass`
// auto-commits and ends the loop; a `fail` carries the feedback into the next Worker turn; after
// MAX_ROUNDS with no pass the loop escalates to the user, committing nothing. The `blocked` branch
// (V3/02) short-circuits the moment the Reviewer raises a blocker. UI is injected via a reporter
// (dependency inversion) so this stays pure orchestration.

import type { TokenCounts } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { setTaskStatus } from './backlog.js';
import { buildWorkerFixMessage } from './build-worker-fix-message.js';
import { commitPassedTask } from './commit-passed-task.js';
import { formatReviewFeedback } from './format-review-feedback.js';
import { captureChangedFiles } from './project-git.js';
import { ReviewerVerdictError, runReviewerTask } from './reviewer-runner.js';
import type { TaskLoopDeps, TaskLoopReporter, TaskLoopResult } from './run-task-loop.type.js';
import { processMessage } from './turn-loop.js';
import type { Task } from './types.js';
import { buildWorkerSeed, WORKER_MAX_ROUNDS, WorkerWindow } from './worker-runner.js';

/** Hard cap on implement→fix rounds per task — a ceiling, not a target (CLAUDE.md). Assert exactly 5. */
export const MAX_ROUNDS = 5;

/** Run one task through the bounded fix loop; auto-commits on pass, escalates after MAX_ROUNDS. */
export async function runTaskLoop(
  deps: TaskLoopDeps,
  task: Task,
  specSlice: string,
  reporter: TaskLoopReporter,
): Promise<TaskLoopResult> {
  // Mark the task in-flight; it is recorded as `done` only when a pass commits (commitPassedTask).
  setTaskStatus(deps.projectPath, task.id, 'in_progress');

  // ONE persistent Worker window for the WHOLE loop — never reset between rounds (the load-bearing
  // rule): it remembers prior attempts + Reviewer feedback and so converges (CLAUDE.md memory model).
  const worker = new WorkerWindow(deps);

  // Running SUM of every Reviewer turn's exact tokens across all rounds. The Worker's own cumulative
  // total (worker.tokens is already summed across its turns) is added at each return site, so the
  // reported tokens are the exact sum of every Worker + Reviewer turn (constitution: never estimated).
  let reviewerTokens: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  let lastFeedback = '';
  let round = 0;

  try {
    for (round = 1; round <= MAX_ROUNDS; round += 1) {
      reporter.roundStarted(round, MAX_ROUNDS);

      // Round 1 seeds the task; later rounds append the prior Reviewer feedback as the next user turn
      // on the SAME window (no reset). buildWorkerSeed / buildWorkerFixMessage assemble those turns;
      // processMessage runs the Worker's tool-dispatch loop to completion on its own history.
      const message = round === 1 ? buildWorkerSeed(task, specSlice) : buildWorkerFixMessage(lastFeedback);
      await processMessage(worker, message, WORKER_MAX_ROUNDS);

      // captureChangedFiles: host `git status`/`diff` of everything since the last commit (cumulative
      // across rounds, since nothing commits mid-loop). No diff ⇒ nothing to review — re-looping a
      // Worker that produced nothing won't converge, so escalate for a human to inspect.
      const changed = captureChangedFiles(deps.projectPath);
      if (changed.files.length === 0) {
        setTaskStatus(deps.projectPath, task.id, 'pending');
        return {
          taskId: task.id,
          outcome: 'escalated',
          rounds: round,
          lastFeedback: 'The Worker produced no file changes — there is nothing to review.',
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }
      reporter.filesChanged(changed.status);

      // A FRESH, isolated Reviewer window each round judges THIS attempt (V2/01). It sees only the
      // structured input below — never the Worker's internal turns (CLAUDE.md: histories are isolated).
      const outcome = await runReviewerTask(deps, {
        task,
        workerSummary: worker.summary,
        changedFiles: changed.diff !== '' ? `${changed.status}\n\n${changed.diff}` : changed.status,
        testResults: worker.lastTestRun ?? '',
      });
      reviewerTokens = addTokenCounts(reviewerTokens, outcome.tokensTotal);
      reporter.verdictReady(outcome.verdict, changed.files.length, outcome.tokens);

      // Blocker short-circuit (V3/02 populates outcome.blocker): halt immediately, before any fix
      // round, committing nothing. Undefined until V3/02 wires raise_blocker, so this stays dormant.
      if (outcome.blocker) {
        setTaskStatus(deps.projectPath, task.id, 'blocked');
        return {
          taskId: task.id,
          outcome: 'blocked',
          rounds: round,
          question: outcome.blocker.question,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }

      if (outcome.verdict.result === 'pass') {
        // commitPassedTask: flip status→done, stage the reviewed set + backlog file, commit (V2/03).
        const commit = commitPassedTask(deps.projectPath, task, outcome.verdict, changed.files);
        return {
          taskId: task.id,
          outcome: 'passed',
          rounds: round,
          commit,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }

      // fail → carry the Reviewer's feedback into the next Worker turn (and out, if this was round 5).
      lastFeedback = formatReviewFeedback(outcome.verdict);
    }
  } catch (err) {
    // Any mid-loop failure commits nothing; revert to pending so the task stays runnable. A Reviewer
    // that never produced a usable verdict is a reason to escalate to a human, not a crash; anything
    // else (a dropped Ollama stream) propagates for the caller to surface.
    setTaskStatus(deps.projectPath, task.id, 'pending');
    if (err instanceof ReviewerVerdictError) {
      return {
        taskId: task.id,
        outcome: 'escalated',
        rounds: round,
        lastFeedback: err.message,
        tokens: addTokenCounts(reviewerTokens, worker.tokens),
      };
    }
    throw err;
  }

  // MAX_ROUNDS elapsed with no pass — escalate with the last Reviewer feedback; nothing committed.
  setTaskStatus(deps.projectPath, task.id, 'pending');
  return {
    taskId: task.id,
    outcome: 'escalated',
    rounds: MAX_ROUNDS,
    lastFeedback,
    tokens: addTokenCounts(reviewerTokens, worker.tokens),
  };
}
