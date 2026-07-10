// /run <selector> (V1/10) — the execution trigger. Runs backlog tasks SEQUENTIALLY (no
// parallelism), a FRESH Worker window per task, and gates on the USER between tasks: nothing is
// committed automatically (V1 has no auto-Reviewer / auto-commit — the human is the reviewer and
// the git gate). Selector: `next` (top runnable task), a task id, a comma list, or `all`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as renderer from '../../core/ui/renderer.js';
import {
  allTasks,
  BacklogError,
  findTask,
  levelDocs,
  nextRunnableTasks,
  readBacklog,
  setTaskStatus,
} from '../../core/session/index.js';
import type { Backlog, Task } from '../../core/session/index.js';

/** The slice of the orchestrator /run needs — satisfied structurally by SessionOrchestrator. */
export interface RunOrchestrator {
  readonly project: string;
  readonly projectPath: string;
  runWorkerTask(task: Task, specSlice: string): Promise<string>;
}

const SPEC_ARCH_LIMIT = 2500;

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

/** Show the files the Worker touched (best-effort `git status --short` in the project). */
function showTouchedFiles(projectPath: string): void {
  try {
    const out = execFileSync('git', ['-C', projectPath, 'status', '--short'], { encoding: 'utf-8' }).trim();
    renderer.systemMessage(out === '' ? 'No file changes detected.' : `Files changed:\n${out}`);
  } catch {
    renderer.systemMessage('(could not read git status; review the Worker summary above)');
  }
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

export async function runCommand(
  args: readonly string[],
  orch: RunOrchestrator,
  confirm: (question: string) => Promise<boolean>,
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

    renderer.systemMessage(`▶ Running ${task.id}: ${task.title}`);
    setTaskStatus(orch.projectPath, id, 'in_progress');
    const specSlice = buildSpecSlice(orch.projectPath, task);

    let summary: string;
    try {
      summary = await orch.runWorkerTask(task, specSlice);
    } catch (err) {
      setTaskStatus(orch.projectPath, id, 'pending');
      renderer.errorLine(`Worker failed on ${id}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (summary.trim() !== '') {
      renderer.systemMessage(`— ${id} summary —`);
      renderer.systemMessage(summary.trim());
    }
    showTouchedFiles(orch.projectPath);

    const done = await confirm(`Mark ${id} as done? Review and git-commit first`);
    setTaskStatus(orch.projectPath, id, done ? 'done' : 'pending');
    renderer.systemMessage(done ? `✓ ${id} marked done.` : `${id} left pending — re-run to retry.`);
  }
}
