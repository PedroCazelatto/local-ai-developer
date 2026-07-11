// /run <selector> (V1/10 + V2/02–03) — the execution trigger. Runs backlog tasks SEQUENTIALLY (no
// parallelism), a FRESH Worker window per task, then a FRESH Reviewer window that judges the Worker's
// output (V2/01). The verdict is surfaced to the user, who decides accept / send back / skip:
// - accept    → commit the reviewed changed-files set to the project repo (V2/03) + mark the task done
// - send back → leave the work uncommitted; the user re-engages the Worker manually; task stays open
// - skip      → leave uncommitted, task stays open
// SINGLE PASS: after one verdict, control returns to the user — no automatic re-spawn (that, plus
// raise_blocker and Retro, is V3). Selector: `next` (top runnable), a task id, a comma list, or `all`.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as renderer from '../../core/ui/renderer.js';
import {
  allTasks,
  BacklogError,
  buildCommitMessage,
  captureChangedFiles,
  commitPaths,
  findTask,
  isWorkingTreeDirty,
  levelDocs,
  nextRunnableTasks,
  readBacklog,
  setTaskStatus,
} from '../../core/session/index.js';
import type {
  Backlog,
  ReviewDecision,
  ReviewerInput,
  ReviewerOutcome,
  Task,
  WorkerResult,
} from '../../core/session/index.js';
import { renderVerdict } from '../review-prompt.js';

/** The slice of the orchestrator /run needs — satisfied structurally by SessionOrchestrator. */
export interface RunOrchestrator {
  readonly project: string;
  readonly projectPath: string;
  runWorkerTask(task: Task, specSlice: string): Promise<WorkerResult>;
  runReviewerTask(input: ReviewerInput): Promise<ReviewerOutcome>;
}

/** Discrete prompts /run needs from the REPL (readline-backed, to avoid fighting clack for stdin). */
export interface RunPrompts {
  /** Collect the accept / send-back / skip decision after a verdict. null ⇒ treated as send back. */
  askDecision(question: string): Promise<ReviewDecision | null>;
}

const SPEC_ARCH_LIMIT = 2500;

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

/** Resolve the selector to an ordered list of task ids to attempt. */
function resolveSelector(backlog: Backlog, selector: string): string[] {
  if (selector === 'all') {
    return allTasks(backlog)
      .filter((t) => t.status !== 'done')
      .sort((a, b) => a.order - b.order)
      .map((t) => t.id);
  }
  if (selector === 'next') {
    const next = nextRunnableTasks(backlog)[0];
    return next ? [next.id] : [];
  }
  return selector.split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * Commit the accepted changed-files set (V2/03) and mark the task done, or report a recoverable
 * failure and leave the tree dirty + the task pending. Only ever called on an explicit user accept.
 */
function acceptAndCommit(orch: RunOrchestrator, task: Task, outcome: ReviewerOutcome, files: string[]): void {
  const message = buildCommitMessage({
    taskId: task.id,
    taskTitle: task.title,
    type: 'feat',
    reviewerSummary: outcome.verdict.summary,
  });
  const commit = commitPaths(orch.projectPath, message, files);
  if (commit.committed) {
    setTaskStatus(orch.projectPath, task.id, 'done');
    renderer.systemMessage(`✓ ${task.id} committed ${commit.sha ?? ''} — ${commit.files.length} file(s) — and marked done.`);
    return;
  }
  // Recoverable (e.g. a refused out-of-project path → global rule edits are never auto-committed).
  setTaskStatus(orch.projectPath, task.id, 'pending');
  renderer.errorLine(`⚠ Commit failed for ${task.id}: ${commit.error ?? 'unknown error'} Left uncommitted + pending.`);
}

/** Run one already-eligible task: Worker → capture diff → Reviewer → verdict → user decision. */
async function runOneTask(orch: RunOrchestrator, task: Task, prompts: RunPrompts): Promise<void> {
  setTaskStatus(orch.projectPath, task.id, 'in_progress');
  const specSlice = buildSpecSlice(orch.projectPath, task);

  let worker: WorkerResult;
  try {
    worker = await orch.runWorkerTask(task, specSlice);
  } catch (err) {
    setTaskStatus(orch.projectPath, task.id, 'pending');
    renderer.errorLine(`Worker failed on ${task.id}: ${messageOf(err)}`);
    return;
  }

  if (worker.summary.trim() !== '') {
    renderer.systemMessage(`— ${task.id} summary —`);
    renderer.systemMessage(worker.summary.trim());
  }

  // Capture what the Worker changed (host git; the tree was clean at task start). No change ⇒ nothing
  // to review, so don't spawn the Reviewer on an empty diff.
  const changed = captureChangedFiles(orch.projectPath);
  if (changed.files.length === 0) {
    setTaskStatus(orch.projectPath, task.id, 'pending');
    renderer.systemMessage(`${task.id}: the Worker changed no files — nothing to review. Left pending.`);
    return;
  }
  renderer.systemMessage(`Files changed:\n${changed.status}`);

  // Spawn a FRESH, isolated Reviewer (V2/01) seeded with the task + bounded diff + the Worker's tests.
  let outcome: ReviewerOutcome;
  try {
    outcome = await orch.runReviewerTask({
      task,
      workerSummary: worker.summary,
      changedFiles: changed.diff !== '' ? `${changed.status}\n\n${changed.diff}` : changed.status,
      testResults: worker.lastTestRun ?? '',
    });
  } catch (err) {
    setTaskStatus(orch.projectPath, task.id, 'pending');
    renderer.errorLine(`Reviewer produced no verdict for ${task.id}: ${messageOf(err)}. Left pending (uncommitted).`);
    return;
  }

  renderVerdict(outcome.verdict, {
    taskId: task.id,
    taskTitle: task.title,
    changedCount: changed.files.length,
    tokens: outcome.tokens,
  });

  // The USER decides — single pass, no auto re-spawn (V3). Only an explicit accept ever commits.
  const question =
    outcome.verdict.result === 'pass'
      ? `Accept ${task.id} and commit?`
      : `${task.id} did NOT pass review — accept anyway, send back, or skip?`;
  const decision = await prompts.askDecision(question);

  if (decision === 'accept') {
    acceptAndCommit(orch, task, outcome, changed.files);
    return;
  }
  // send back / skip / cancelled → never commit; leave the tree dirty for the user to continue.
  setTaskStatus(orch.projectPath, task.id, 'pending');
  const how = decision === 'skip' ? 'skipped' : 'sent back';
  renderer.systemMessage(`${task.id} ${how} — left uncommitted + pending. Resolve/commit before the next run.`);
}

export async function runCommand(
  args: readonly string[],
  orch: RunOrchestrator,
  prompts: RunPrompts,
): Promise<void> {
  const selector = args[0] ?? 'next';

  let backlog: Backlog;
  try {
    backlog = readBacklog(orch.projectPath);
  } catch (err) {
    renderer.errorLine(err instanceof BacklogError ? err.message : String(err));
    return;
  }

  const ids = resolveSelector(backlog, selector);
  if (ids.length === 0) {
    renderer.systemMessage(
      selector === 'next' || selector === 'all'
        ? 'No runnable tasks (all done, or blocked by unmet dependencies).'
        : `No tasks matched selector '${selector}'.`,
    );
    return;
  }

  for (const id of ids) {
    // Reload each iteration: the user's done/pending decisions change what is now eligible.
    const current = readBacklog(orch.projectPath);
    const task = findTask(current, id);
    if (task === undefined) {
      renderer.errorLine(`Skipping '${id}': not found in the backlog.`);
      continue;
    }
    if (task.status === 'done') {
      renderer.systemMessage(`Skipping ${id}: already done.`);
      continue;
    }
    const statusById = new Map(allTasks(current).map((t) => [t.id, t.status]));
    const unmet = task.dependsOn.filter((d) => statusById.get(d) !== 'done');
    if (unmet.length > 0) {
      renderer.systemMessage(`Skipping ${id}: waiting on ${unmet.join(', ')} (not done).`);
      continue;
    }

    // Block on a dirty tree: each review must capture EXACTLY this task's changes (the user's V2
    // choice). A fresh scaffold is dirty (git init, no commit), so the user commits the baseline —
    // scaffold + backlog + spec — first; a sent-back/skipped prior task also leaves the tree dirty.
    // A dirty tree won't clear itself, so halt the whole run rather than mixing two tasks' changes.
    if (isWorkingTreeDirty(orch.projectPath)) {
      renderer.errorLine(
        `Halting before ${id}: the project working tree has uncommitted changes, so its review can't ` +
          `be isolated. Commit or stash them first (right after /new-project, commit the scaffold + ` +
          `backlog + PRODUCT_SPEC), then re-run.`,
      );
      return;
    }

    renderer.systemMessage(`▶ Running ${task.id}: ${task.title}`);
    await runOneTask(orch, task, prompts);
  }
}
