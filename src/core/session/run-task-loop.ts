// The V3/01 implement→test→review→fix controller — the choke point the rest of V3 hangs off. For
// ONE task it runs a bounded loop: the Worker window is created ONCE and reused across every round
// (its history accumulates each attempt + the Reviewer's feedback, so it converges instead of
// starting blind); the Reviewer gets a FRESH window each round (no cross-round leakage). A `fail`
// carries the feedback into the next Worker turn; after MAX_ROUNDS with no pass the loop escalates to
// the user. The `blocked` branch (V3/02) short-circuits the moment the Reviewer raises a blocker. UI
// is injected via a reporter (dependency inversion) so this stays pure orchestration.
//
// Committing is NOT this loop's job. The Reviewer owns it: it commits the files it accepts (possibly
// only some of them) with commit_changes and marks the task done with mark_task_done, and its verdict
// is refused unless the repo agrees. So a round can land commits even when the verdict is a fail, and
// a `pass` is proof the tree was already clean — the loop just reports what the Reviewer committed.

import { TurnAbortedError } from '../llm/index.js';
import type { TokenCounts } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { setTaskStatus } from './set-task-status.js';
import { buildWorkerFixMessage } from './build-worker-fix-message.js';
import { formatReviewFeedback } from './format-review-feedback.js';
import { captureChangedFiles } from './capture-changed-files.js';
import { ReviewerVerdictError, runReviewerTask } from './reviewer-runner.js';
import type { ReviewerCommit } from './reviewer-runner.js';
import type { TaskLoopDeps, TaskLoopReporter, TaskLoopResult } from './run-task-loop.type.js';
import { processMessage } from './turn-loop.js';
import type { Task } from './types.js';
import { buildWorkerSeed, WORKER_MAX_ROUNDS, WorkerWindow } from './worker-runner.js';

/** Hard cap on implement→fix rounds per task — a ceiling, not a target (CLAUDE.md). Assert exactly 5. */
export const MAX_ROUNDS = 5;

/** Run one task through the bounded fix loop; the Reviewer commits, and it escalates after MAX_ROUNDS. */
export async function runTaskLoop(
  deps: TaskLoopDeps,
  task: Task,
  specSlice: string,
  reporter: TaskLoopReporter,
): Promise<TaskLoopResult> {
  // Mark the task in-flight. It becomes `done` only when the Reviewer calls mark_task_done and commits
  // the backlog file — a pass is refused otherwise, so the flip is always recorded in git.
  setTaskStatus(deps.projectPath, task.id, 'in_progress');

  // ONE persistent Worker window for the WHOLE loop — never reset between rounds (the load-bearing
  // rule): it remembers prior attempts + Reviewer feedback and so converges (CLAUDE.md memory model).
  const worker = new WorkerWindow(deps);

  // Running SUM of every Reviewer turn's exact tokens across all rounds. The Worker's own cumulative
  // total (worker.tokens is already summed across its turns) is added at each return site, so the
  // reported tokens are the exact sum of every Worker + Reviewer turn (constitution: never estimated).
  let reviewerTokens: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  let lastFeedback = '';
  /** Files the previous round's Reviewer committed — named in the next fix turn so they aren't redone. */
  let lastAccepted: readonly string[] = [];
  let round = 0;
  // Every commit the Reviewer landed across ALL rounds. Partial acceptance means these accumulate even
  // on rounds that failed, and they are reported on every exit path — the work is in git either way.
  const commits: ReviewerCommit[] = [];

  try {
    for (round = 1; round <= MAX_ROUNDS; round += 1) {
      // `/stop round` wind-down: checked HERE, before a round starts, so the round already running
      // finishes cleanly (its Reviewer commits what it accepts) and only the NEXT one is refused. Round 1
      // is included: a stop asked for while the batch was between tasks must not start work at all.
      if (deps.stop.stopBeforeNextRound) {
        setTaskStatus(deps.projectPath, task.id, 'pending');
        return {
          taskId: task.id,
          outcome: 'cancelled',
          rounds: round - 1,
          cancelReason: 'stopped by /stop round before the next round.',
          commits,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }
      reporter.roundStarted(round, MAX_ROUNDS);

      // Round 1 seeds the task; later rounds append the prior Reviewer feedback as the next user turn
      // on the SAME window (no reset). buildWorkerSeed / buildWorkerFixMessage assemble those turns;
      // processMessage runs the Worker's tool-dispatch loop to completion on its own history.
      const message = round === 1 ? buildWorkerSeed(task, specSlice) : buildWorkerFixMessage(lastFeedback, lastAccepted);
      await processMessage(worker, message, WORKER_MAX_ROUNDS);

      // captureChangedFiles: host `git status`/`diff` of everything since the last commit — i.e. exactly
      // what this round left over, since a prior round's Reviewer committed whatever it accepted. No diff
      // ⇒ nothing to review — re-looping a Worker that produced nothing won't converge, so escalate.
      const changed = captureChangedFiles(deps.projectPath);
      if (changed.files.length === 0) {
        setTaskStatus(deps.projectPath, task.id, 'pending');
        return {
          taskId: task.id,
          outcome: 'escalated',
          rounds: round,
          lastFeedback: 'The Worker produced no file changes — there is nothing to review.',
          commits,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }
      reporter.filesChanged(changed.status);

      // A FRESH, isolated Reviewer window each round judges THIS attempt (V2/01). It sees only the
      // structured input below — never the Worker's internal turns (CLAUDE.md: histories are isolated).
      const outcome = await runReviewerTask(deps, {
        task,
        round,
        workerSummary: worker.summary,
        changedFiles: changed.diff !== '' ? `${changed.status}\n\n${changed.diff}` : changed.status,
        testResults: worker.lastTestRun ?? '',
      });
      reviewerTokens = addTokenCounts(reviewerTokens, outcome.tokensTotal);
      // Whatever this Reviewer committed is already in git — record it before branching, so a blocked
      // or escalated exit still reports the work that landed.
      commits.push(...outcome.commits);
      const committedThisRound = outcome.commits.flatMap((commit) => [...commit.files]);

      // Blocker short-circuit (V3/02): the Reviewer raised a blocker INSTEAD of a verdict — the task
      // itself is unjudgeable. Halt immediately, BEFORE any verdict handling or fix round. Anything the
      // Reviewer accepted before halting stays committed. The `raised` row is already durable (the
      // Reviewer window persisted it); the /run scheduler stashes the rest and moves on.
      if (outcome.blocker) {
        setTaskStatus(deps.projectPath, task.id, 'blocked');
        return {
          taskId: task.id,
          outcome: 'blocked',
          rounds: round,
          question: outcome.blocker.question,
          blockerId: outcome.blocker.id,
          commits,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }

      // Past the blocker check, runReviewerTask guarantees a verdict (it returns exactly one of the
      // two). Narrow the optional here, and defensively escalate rather than crash if a future change
      // ever returns neither.
      const verdict = outcome.verdict;
      if (verdict === undefined) {
        setTaskStatus(deps.projectPath, task.id, 'pending');
        return {
          taskId: task.id,
          outcome: 'escalated',
          rounds: round,
          lastFeedback: 'The Reviewer returned neither a verdict nor a blocker.',
          commits,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }
      reporter.verdictReady(verdict, changed.files.length, outcome.tokens);

      if (verdict.result === 'pass') {
        // Nothing to commit here: a pass is only accepted once the Reviewer has committed everything
        // AND marked the task done (verdictGitConflict enforces both against the real repo), so the
        // tree is already clean and the backlog file already says `done` in the git history.
        return {
          taskId: task.id,
          outcome: 'passed',
          rounds: round,
          commits,
          tokens: addTokenCounts(reviewerTokens, worker.tokens),
        };
      }

      // fail → carry the Reviewer's feedback into the next Worker turn (and out, if this was round 5).
      // The next turn also names what this round accepted, so the Worker doesn't redo committed files.
      lastFeedback = formatReviewFeedback(verdict);
      lastAccepted = committedThisRound;
    }
  } catch (err) {
    // Revert to pending so the task stays runnable. Anything a Reviewer already committed STAYS
    // committed — the orchestrator never rewrites project history — so `commits` still reports it. A
    // Reviewer that never produced a usable verdict is a reason to escalate to a human, not a crash;
    // anything else (a dropped Ollama stream) propagates for the caller to surface.
    setTaskStatus(deps.projectPath, task.id, 'pending');
    // Ctrl+C cut the Worker's or the Reviewer's model call. That is an interruption, not a failed
    // attempt: reporting it as an escalation would put a judgement in the summary that no Reviewer made,
    // and (once record-attempted-tasks lands) would count a round the user stopped against the task.
    if (err instanceof TurnAbortedError) {
      return {
        taskId: task.id,
        outcome: 'cancelled',
        rounds: round,
        cancelReason:
          err.reason === 'user'
            ? `cancelled during round ${round}.`
            : `round ${round} was abandoned — ${err.message}`,
        commits,
        tokens: addTokenCounts(reviewerTokens, worker.tokens),
      };
    }
    if (err instanceof ReviewerVerdictError) {
      return {
        taskId: task.id,
        outcome: 'escalated',
        rounds: round,
        lastFeedback: err.message,
        commits,
        tokens: addTokenCounts(reviewerTokens, worker.tokens),
      };
    }
    throw err;
  }

  // MAX_ROUNDS elapsed with no pass — escalate with the last Reviewer feedback. Whatever the Reviewers
  // accepted along the way is already committed; what is left in the tree is what never passed.
  setTaskStatus(deps.projectPath, task.id, 'pending');
  return {
    taskId: task.id,
    outcome: 'escalated',
    rounds: MAX_ROUNDS,
    lastFeedback,
    commits,
    tokens: addTokenCounts(reviewerTokens, worker.tokens),
  };
}
