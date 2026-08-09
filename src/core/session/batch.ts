// The V3/05 unattended batch driver — "kick off a batch and walk away." It walks the selected backlog
// tasks STRICTLY SEQUENTIALLY (no parallelism — a 3060 holds one window at a time; a hard constraint, not
// a perf choice), routing each task's V3/01 loop outcome without a human in the inner loop:
//   - passed    → the Reviewer already committed all of it; record + continue.
//   - escalated → stash whatever is LEFT (preserved for inspection); record + continue.
//   - blocked   → stash what is left (Retro reads it later on /answer); record + continue.
// A non-pass is no longer "uncommitted": the Reviewer accepts files partially, so an earlier round may
// have landed some of the work — each bucket carries the SHAs that did.
// A blocker or an escalation is a PER-TASK result, never a batch failure — the whole value of an overnight
// run is that one ambiguous task doesn't waste the other eleven hours. The batch aborts ONLY on a genuine
// infra fault (Ollama down, sandbox unreachable) or a pre-flight refusal, and even then it persists a
// PARTIAL summary and exits cleanly. UI is injected via a reporter (dependency inversion) so this stays
// pure orchestration; the exact per-task token counts are summed into one exact batch total (constitution).

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { TokenCounts } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { findTask, readBacklog, taskSkipReason } from './backlog.js';
import type {
  BatchBlocked,
  BatchCancelled,
  BatchDeps,
  BatchEscalated,
  BatchPassed,
  BatchPosition,
  BatchReporter,
  BatchSkipped,
  BatchSummary,
} from './batch.type.js';
import { isWorkingTreeDirty, stashTaskAttempt } from './project-git.js';
import { rulesPhasesDirty } from './rules-phases-dirty.js';
import type { TaskLoopResult } from './run-task-loop.type.js';

/** Folder under .orchestrator/ holding one JSON file per batch (git-ignored session state). */
export const BATCHES_DIRNAME = 'batches';

/** Pre-flight refusal: an unreviewed Retro systemic patch sits uncommitted in the orchestrator repo. */
const PREFLIGHT_RULES_WARNING =
  'the orchestrator repo has uncommitted rules/phases/ changes (an unreviewed Retro systemic patch). ' +
  "Review and commit it manually before running a batch — the orchestrator's own instructions must " +
  'never mutate silently (constitution).';

/** Pre-flight refusal: the project tree is dirty, so no task review could be isolated. */
const PREFLIGHT_DIRTY_WARNING =
  'the project working tree has uncommitted changes, so no task review can be isolated. Commit or stash ' +
  'them first (right after /new-project, commit the scaffold + backlog + PRODUCT_SPEC), then re-run.';

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
    routeOutcome(deps.projectPath, result, { passed, escalated, blocked, cancelled });

    // A cancelled task ends the batch. Ctrl+C cut a model call mid-round, so continuing would start the
    // NEXT task on a box the user just reached for the stop key on — the opposite of what the press meant.
    if (result.outcome === 'cancelled') {
      stoppedReason = `${result.cancelReason ?? 'cancelled.'} ${taskIds.length - i - 1} task(s) not started.`;
      break;
    }
  }

  const summary: BatchSummary = {
    seq: nextSeq(deps.projectPath),
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
  persistSummary(deps.projectPath, summary);
  reporter.finished(summary);
  return summary;
}

/** The persisted file name for a summary: `<zero-padded seq>-<compact startedAt>.json` (Windows-safe). */
export function batchSummaryFileName(summary: Pick<BatchSummary, 'seq' | 'startedAt'>): string {
  return `${String(summary.seq).padStart(4, '0')}-${compactTimestamp(summary.startedAt)}.json`;
}

/** A pre-flight refusal reason, or undefined when the batch may start. */
function preflightRefusal(projectPath: string): string | undefined {
  if (rulesPhasesDirty()) return `Refusing to start the batch: ${PREFLIGHT_RULES_WARNING}`;
  if (isWorkingTreeDirty(projectPath)) return `Refusing to start the batch: ${PREFLIGHT_DIRTY_WARNING}`;
  return undefined;
}

/**
 * Route one task's terminal outcome into the summary buckets. A non-pass stashes whatever is LEFT in
 * the tree so it is clean for the next task — the Worker never reuses the stash (a fresh Worker redoes
 * the task), it exists for Retro (blocked) / inspection (escalated). Note a non-pass can still have
 * committed work: the Reviewer accepts files partially, so `commits` is carried on every bucket.
 */
function routeOutcome(
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

/** Next sequential batch number: one past the highest `<n>-` prefix already in .orchestrator/batches/. */
function nextSeq(projectPath: string): number {
  const dir = path.join(projectPath, '.orchestrator', BATCHES_DIRNAME);
  if (!existsSync(dir)) return 1;
  let max = 0;
  for (const name of readdirSync(dir)) {
    const prefix = /^(\d+)-/.exec(name);
    if (prefix) max = Math.max(max, Number(prefix[1]));
  }
  return max + 1;
}

/** Write the summary as pretty JSON under .orchestrator/batches/ so the morning-after report survives the REPL. */
function persistSummary(projectPath: string, summary: BatchSummary): void {
  const dir = path.join(projectPath, '.orchestrator', BATCHES_DIRNAME);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, batchSummaryFileName(summary)), `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
}

/** UTC ISO → a filename-safe stamp: `2026-07-11T03:04:05.678Z` → `20260711T030405Z` (no colons/dots). */
function compactTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}
