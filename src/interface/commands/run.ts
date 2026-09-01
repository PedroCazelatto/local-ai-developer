// /run <selector> (V1/10 trigger → V3/01 loop → V3/05 batch). Runs backlog tasks SEQUENTIALLY (no
// parallelism); each task goes through the bounded implement→test→review→fix loop (runTaskLoop): a
// PERSISTENT Worker window across up to 5 rounds, and a FRESH Reviewer each round which COMMITS the files
// it accepts (possibly only some of them), escalating after 5 without a pass. The user is pulled in only
// on an escalation or a blocker.
//
// Selector → dispatch:
//   - a single task (`next`, or one explicit id) runs one runTaskLoop directly (this file).
//   - a batch (`all`, or a comma list of 2+ ids) runs UNATTENDED via runBatch (V3/05): sequential,
//     queues escalations/blockers without aborting, prints + persists an end-of-batch summary.
// A non-passing single task stashes whatever is LEFT of its attempt (kept for a later /answer→Retro, or
// inspection) and leaves the tree clean — the Worker never reuses it; a fresh Worker redoes the task from
// scratch. Files a Reviewer accepted along the way are already committed and are not part of the stash.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { TokenCounts } from '../../core/llm/index.js';
import { renderer } from '../../core/ui/renderer.js';
import {
  allTasks,
  BacklogError,
  findTask,
  isWorkingTreeDirty,
  levelDocs,
  nextRunnableTasks,
  readBacklog,
  runBatch,
  stashTaskAttempt,
  taskSkipReason,
} from '../../core/session/index.js';
import type {
  Backlog,
  BatchDeps,
  BatchPosition,
  BatchReporter,
  RunStopSignal,
  Task,
  TaskLoopReporter,
  TaskLoopResult,
} from '../../core/session/index.js';
import { renderBatchSummary } from '../render-batch-summary.js';
import { renderVerdict } from '../render-verdict.js';
import type { Command } from '../command.type.js';
import type { CompletionContext } from '../completion-context.type.js';

/** The slice of the orchestrator /run needs — satisfied structurally by SessionOrchestrator. */
export interface RunOrchestrator {
  readonly project: string;
  readonly projectPath: string;
  // runTaskLoop: the V3/01 implement→test→review→fix controller for one task; the Reviewer commits.
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult>;
  /** The `/stop` wind-down request — armed for the length of a run so the fence can claim `/stop`. */
  readonly runStop: RunStopSignal;
}

/** A resolved selector: the ordered task ids to attempt, and whether it is an unattended batch. */
interface Selection {
  readonly ids: string[];
  readonly isBatch: boolean;
}

const SPEC_ARCH_LIMIT = 2500;

const HALT_DIRTY =
  'the project working tree has uncommitted changes, so its review can\'t be isolated. Commit or stash ' +
  'them first (right after /new-project, commit the scaffold + backlog + PRODUCT_SPEC), then re-run.';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Extract a `## <heading>` section body from markdown, up to the next `## ` or EOF. */
function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return '';
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').startsWith('## ')) break;
    body.push(lines[i] ?? '');
  }
  return body.join('\n').trim();
}

/** Build a FOCUSED context slice for the Worker: its epic/story level docs + the Architecture excerpt. */
function buildSpecSlice(projectPath: string, task: Task): string {
  const context: string[] = ['## Context'];
  const where = [task.epic ? `Epic: ${task.epic}` : null, task.story ? `Story: ${task.story}` : null].filter(
    (s): s is string => s !== null,
  );
  if (where.length > 0) context.push(where.join('  ·  '));

  const docs = levelDocs(projectPath, task);
  if (docs.epic) context.push('', `### Epic (${task.epic}/README.md)`, docs.epic.slice(0, SPEC_ARCH_LIMIT));
  if (docs.story) {
    context.push('', `### Story (${task.epic}/${task.story}/README.md)`, docs.story.slice(0, SPEC_ARCH_LIMIT));
  }

  const specPath = path.join(projectPath, 'PRODUCT_SPEC.md');
  if (existsSync(specPath)) {
    try {
      const section = extractSection(readFileSync(specPath, 'utf-8'), 'Architecture');
      if (section) context.push('', '### Architecture (excerpt from PRODUCT_SPEC.md)', section.slice(0, SPEC_ARCH_LIMIT));
    } catch {
      /* spec unreadable — fall back to just the level-doc context */
    }
  }
  return context.join('\n');
}

/** Resolve the selector to the ordered ids to attempt, and whether it is a batch (all, or 2+ ids). */
function resolveSelector(backlog: Backlog, selector: string): Selection {
  if (selector === 'all') {
    const ids = allTasks(backlog)
      .filter((t) => t.status !== 'done')
      .sort((a, b) => a.order - b.order)
      .map((t) => t.id);
    return { ids, isBatch: true };
  }
  if (selector === 'next') {
    const next = nextRunnableTasks(backlog)[0];
    return { ids: next ? [next.id] : [], isBatch: false };
  }
  const ids = selector.split(',').map((s) => s.trim()).filter((s) => s !== '');
  return { ids, isBatch: ids.length > 1 };
}

/** Exact loop-cost line — never a length estimate; says "not reported" when a metric was omitted. */
function tokenCostLine(tokens: TokenCounts): string {
  const prompt = tokens.promptTokens === null ? 'not reported' : String(tokens.promptTokens);
  const evalT = tokens.evalTokens === null ? 'not reported' : String(tokens.evalTokens);
  return `loop cost — prompt ${prompt}, completion ${evalT} tokens (exact, summed over all rounds)`;
}

/** Render one task's terminal outcome: passed (committed), blocked (question), or escalated (feedback). */
function renderOutcome(result: TaskLoopResult): void {
  const cost = tokenCostLine(result.tokens);
  // The Reviewer commits in pieces, so a task normally lands several SHAs; drop any the git call
  // reported no sha for rather than printing a placeholder that looks like a ref.
  const shas = result.commits.map((commit) => commit.sha).filter((sha): sha is string => sha !== null);
  const committed = shas.length === 0 ? '(no sha)' : shas.join(', ');

  if (result.outcome === 'passed') {
    renderer.systemMessage(
      `✓ ${result.taskId} PASSED in ${result.rounds} round(s) — committed ${committed} + marked done · ${cost}`,
    );
    return;
  }
  if (result.outcome === 'blocked') {
    renderer.errorLine(`⛔ ${result.taskId} BLOCKED at round ${result.rounds}: ${result.question ?? ''}`);
    renderer.systemMessage(
      `Persisted as ${result.blockerId ?? result.taskId}. Answer later with: /answer ${result.taskId} <your answer> · ${cost}`,
    );
    return;
  }
  if (result.outcome === 'cancelled') {
    // Deliberately a plain system line, not an error: the user stopped this, and whatever the Reviewer
    // accepted before the interruption is already committed and is reported the same way as elsewhere.
    renderer.systemMessage(`⎋ ${result.taskId} STOPPED after ${result.rounds} round(s) — ${result.cancelReason ?? ''}`);
    if (shas.length > 0) {
      renderer.systemMessage(`The Reviewer had already accepted part of it: ${committed}`);
    }
    renderer.systemMessage(cost);
    return;
  }
  // escalated — 5 rounds with no pass (or an empty diff / no verdict). Partial acceptance means some
  // of it may already be committed; only what never passed is still in the working tree.
  renderer.errorLine(
    `⚠ ${result.taskId} ESCALATED after ${result.rounds} round(s) without a pass — the rest is left uncommitted.`,
  );
  if (shas.length > 0) {
    renderer.systemMessage(`The Reviewer did accept part of it along the way: ${committed}`);
  }
  if (result.lastFeedback !== undefined && result.lastFeedback.trim() !== '') {
    renderer.systemMessage(`Last Reviewer feedback:\n${result.lastFeedback.trim()}`);
  }
  renderer.systemMessage(cost);
}

/** The per-task UI the loop reports progress through (injected). `position` adds the batch `[N/M]` prefix. */
function buildReporter(task: Task, position?: BatchPosition): TaskLoopReporter {
  const prefix = position ? `[${position.index}/${position.total}] ${task.id}` : task.id;
  return {
    roundStarted: (round, maxRounds) => renderer.systemMessage(`▶ ${prefix} · round ${round}/${maxRounds}`),
    filesChanged: (status) => renderer.systemMessage(`Files changed:\n${status}`),
    // renderVerdict: PASS/FAIL headline, summary, issues by severity, exact Reviewer tokens (V2/02).
    verdictReady: (verdict, changedCount, tokens) =>
      renderVerdict(verdict, { taskId: task.id, taskTitle: task.title, changedCount, tokens }),
  };
}

/** The batch-level UI seam (V3/05): per-task start/skip lines, each outcome, and the end-of-batch table. */
function buildBatchReporter(): BatchReporter {
  return {
    taskStarted: (position, task) =>
      renderer.systemMessage(`▶ [${position.index}/${position.total}] ${task.id}: ${task.title}`),
    taskSkipped: (taskId, reason) => renderer.systemMessage(`Skipping ${taskId}: ${reason}`),
    taskOutcome: (result) => renderOutcome(result),
    finished: (summary) => renderBatchSummary(summary),
  };
}

/** Run one already-eligible task through the V3/01 fix loop, render its outcome, and return it (or null on error). */
async function runOneTask(orch: RunOrchestrator, task: Task): Promise<TaskLoopResult | null> {
  const specSlice = buildSpecSlice(orch.projectPath, task);
  let result: TaskLoopResult;
  try {
    // runTaskLoop: persistent Worker across ≤5 rounds, fresh Reviewer each round which commits what it accepts.
    result = await orch.runTaskLoop(task, specSlice, buildReporter(task));
  } catch (err) {
    renderer.errorLine(`Task loop failed on ${task.id}: ${messageOf(err)}. Left uncommitted.`);
    return null;
  }
  renderOutcome(result);
  return result;
}

/** Run exactly one selected task directly (the `next` / single-id path). */
async function runSingle(orch: RunOrchestrator, id: string): Promise<void> {
  const backlog = readBacklog(orch.projectPath);
  const reason = taskSkipReason(backlog, id);
  if (reason !== null) {
    renderer.systemMessage(`Skipping ${id}: ${reason}`);
    return;
  }
  const task = findTask(backlog, id);
  if (task === undefined) return; // unreachable (taskSkipReason returned null), guarded defensively

  // Block on a dirty tree: each review must capture EXACTLY this task's changes (a fresh scaffold is
  // dirty until the user commits the baseline; a prior non-passing task stashes itself clean).
  if (isWorkingTreeDirty(orch.projectPath)) {
    renderer.errorLine(`Halting before ${id}: ${HALT_DIRTY}`);
    return;
  }

  renderer.systemMessage(`▶ Running ${task.id}: ${task.title}`);
  const result = await runOneTask(orch, task);

  // A non-passing task stashes its failed attempt so the tree is left clean and the work is preserved —
  // blocked → the later /answer→Retro reads it; escalated → the user can inspect it. The Worker NEVER
  // reuses the stash (a fresh Worker redoes the task from scratch); a git failure just returns null.
  if (result !== null && result.outcome !== 'passed') {
    const stashRef = stashTaskAttempt(orch.projectPath, task.id);
    const where = stashRef ?? 'nothing to stash';
    if (result.outcome === 'blocked') {
      renderer.systemMessage(`Attempt stashed (${where}). Answer with /answer ${task.id} <text>, then /run to retry.`);
    } else {
      renderer.systemMessage(`Attempt stashed (${where}) for inspection; /run ${task.id} to retry from scratch.`);
    }
  }
}

async function dispatchRun(args: readonly string[], orch: RunOrchestrator): Promise<void> {
  const selector = args[0] ?? 'next';

  let backlog: Backlog;
  try {
    backlog = readBacklog(orch.projectPath);
  } catch (err) {
    renderer.errorLine(err instanceof BacklogError ? err.message : String(err));
    return;
  }

  const selection = resolveSelector(backlog, selector);
  if (selection.ids.length === 0) {
    renderer.systemMessage(
      selector === 'next' || selector === 'all'
        ? 'No runnable tasks (all done, or blocked by unmet dependencies).'
        : `No tasks matched selector '${selector}'.`,
    );
    return;
  }

  if (!selection.isBatch) {
    await runSingle(orch, selection.ids[0] ?? '');
    return;
  }

  // Unattended batch (V3/05): runBatch walks the ids sequentially, queuing escalations/blockers without
  // aborting, and prints + persists the summary. The runTask seam wraps runTaskLoop with the Worker's
  // spec slice + a position-aware reporter, so the core driver never imports a renderer (dependency
  // inversion). Per-task eligibility, dirty-tree guarding, and stashing live inside runBatch.
  const deps: BatchDeps = {
    projectPath: orch.projectPath,
    runTask: (task, position) => orch.runTaskLoop(task, buildSpecSlice(orch.projectPath, task), buildReporter(task, position)),
    // The same signal the fence arms from a `/stop` line — the batch reads it between tasks.
    stop: orch.runStop,
  };
  await runBatch(deps, selection.ids, buildBatchReporter());
}

/**
 * Tab candidates for `/run <selector>`: the two static selectors plus every not-done task id — the same
 * set `all` would sweep, so nothing is offered that resolveSelector would then skip. Only the selector is
 * completable; a comma list past the first id isn't (the partial word carries the commas with it).
 */
function completeRun(ctx: CompletionContext): string[] {
  if (ctx.args.length > 0) return [];
  try {
    // readBacklog is a SYNC file read, which is what makes it safe in a completer that must never await
    // (complete-line.ts). A missing or malformed backlog just means no ids to offer, never a thrown Tab.
    const ids = allTasks(readBacklog(ctx.orch.projectPath))
      .filter((t) => t.status !== 'done')
      .map((t) => t.id);
    return ['next', 'all', ...ids];
  } catch {
    return ['next', 'all'];
  }
}

/**
 * Bracket the whole run with the stop signal armed, so `/stop` typed into the fence is claimed for
 * exactly as long as there is something to stop — and cleared afterwards, so a stop asked for during one
 * run can never wind down the next one before it has started.
 */
async function runWithStopArmed(args: readonly string[], orch: RunOrchestrator): Promise<void> {
  orch.runStop.begin();
  try {
    await dispatchRun(args, orch);
  } finally {
    orch.runStop.end();
  }
}

export const runCommand: Command = {
  name: 'run',
  group: 'execution',
  description: 'Run backlog tasks through the implement→test→review→fix loop (the Reviewer commits what it accepts)',
  usage: '/run [next | all | <task-id>[,<id>…]]',
  complete: completeRun,
  run: (ctx) => runWithStopArmed(ctx.args, ctx.orch),
};
