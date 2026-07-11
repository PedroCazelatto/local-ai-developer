// /run <selector> (V3/01) — the execution trigger. Runs backlog tasks SEQUENTIALLY (no parallelism);
// each task goes through the bounded implement→test→review→fix loop (runTaskLoop): a PERSISTENT
// Worker window across up to 5 rounds, a FRESH Reviewer each round, AUTO-COMMIT on a pass, escalate
// after 5 with nothing committed. The user is pulled in only on an escalation or a blocker — not on
// every round (that was V2's accept/send-back/skip gate). Selector: `next` (top runnable), a task id,
// a comma list, or `all`.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { TokenCounts } from '../../core/llm/index.js';
import * as renderer from '../../core/ui/renderer.js';
import {
  allTasks,
  BacklogError,
  discardWorkingTreeChanges,
  findTask,
  isWorkingTreeDirty,
  levelDocs,
  nextRunnableTasks,
  readBacklog,
} from '../../core/session/index.js';
import type { Backlog, Task, TaskLoopReporter, TaskLoopResult } from '../../core/session/index.js';
import { renderVerdict } from '../review-prompt.js';

/** The slice of the orchestrator /run needs — satisfied structurally by SessionOrchestrator. */
export interface RunOrchestrator {
  readonly project: string;
  readonly projectPath: string;
  // runTaskLoop: the V3/01 implement→test→review→fix controller for one task; auto-commits on pass.
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult>;
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

/** Exact loop-cost line — never a length estimate; says "not reported" when a metric was omitted. */
function tokenCostLine(tokens: TokenCounts): string {
  const prompt = tokens.promptTokens === null ? 'not reported' : String(tokens.promptTokens);
  const evalT = tokens.evalTokens === null ? 'not reported' : String(tokens.evalTokens);
  return `loop cost — prompt ${prompt}, completion ${evalT} tokens (exact, summed over all rounds)`;
}

/** Render the loop's terminal outcome: passed (committed), blocked (question), or escalated (feedback). */
function renderOutcome(result: TaskLoopResult): void {
  const cost = tokenCostLine(result.tokens);
  if (result.outcome === 'passed') {
    renderer.systemMessage(
      `✓ ${result.taskId} PASSED in ${result.rounds} round(s) — committed ${result.commit ?? '(no sha)'} + marked done · ${cost}`,
    );
    return;
  }
  if (result.outcome === 'blocked') {
    renderer.errorLine(`⛔ ${result.taskId} BLOCKED at round ${result.rounds}: ${result.question ?? ''}`);
    renderer.systemMessage(
      `Persisted as ${result.blockerId ?? result.taskId}; its changes were reverted and the run continues ` +
        `with other runnable tasks. Answer later with: /answer ${result.taskId} <your answer> · ${cost}`,
    );
    return;
  }
  // escalated — 5 rounds with no pass (or an empty diff / no verdict). Nothing was committed.
  renderer.errorLine(
    `⚠ ${result.taskId} ESCALATED after ${result.rounds} round(s) without a pass — left uncommitted for you to inspect.`,
  );
  if (result.lastFeedback !== undefined && result.lastFeedback.trim() !== '') {
    renderer.systemMessage(`Last Reviewer feedback:\n${result.lastFeedback.trim()}`);
  }
  renderer.systemMessage(cost);
}

/** The UI the loop reports progress through (injected — the core loop hard-wires no renderer). */
function buildReporter(task: Task): TaskLoopReporter {
  return {
    roundStarted: (round, maxRounds) => renderer.systemMessage(`▶ Round ${round}/${maxRounds} — ${task.id}`),
    filesChanged: (status) => renderer.systemMessage(`Files changed:\n${status}`),
    // renderVerdict: PASS/FAIL headline, summary, issues by severity, exact Reviewer tokens (V2/02).
    verdictReady: (verdict, changedCount, tokens) =>
      renderVerdict(verdict, { taskId: task.id, taskTitle: task.title, changedCount, tokens }),
  };
}

/** Run one already-eligible task through the V3/01 fix loop, render its outcome, and return it (or null on error). */
async function runOneTask(orch: RunOrchestrator, task: Task): Promise<TaskLoopResult | null> {
  const specSlice = buildSpecSlice(orch.projectPath, task);
  let result: TaskLoopResult;
  try {
    // runTaskLoop: persistent Worker across ≤5 rounds, fresh Reviewer each round, auto-commit on pass.
    result = await orch.runTaskLoop(task, specSlice, buildReporter(task));
  } catch (err) {
    renderer.errorLine(`Task loop failed on ${task.id}: ${messageOf(err)}. Left uncommitted.`);
    return null;
  }
  renderOutcome(result);
  return result;
}

export async function runCommand(args: readonly string[], orch: RunOrchestrator): Promise<void> {
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

  // Task ids blocked during THIS run, for the closing summary. A blocker doesn't abort the run: the
  // task is skipped, its changes reverted, and the loop moves on to whatever is still runnable (the
  // user answers with /answer afterward, then re-runs). Its dependents fall out naturally — they wait
  // on a task that isn't `done`, so the unmet-deps check below skips them.
  const blockedThisRun: string[] = [];

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
    if (task.status === 'blocked') {
      renderer.systemMessage(`Skipping ${id}: blocked, awaiting your /answer. Answer it, then /run again.`);
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
    // (A just-blocked task does NOT trip this: its changes are reverted below before we continue.)
    if (isWorkingTreeDirty(orch.projectPath)) {
      renderer.errorLine(
        `Halting before ${id}: the project working tree has uncommitted changes, so its review can't ` +
          `be isolated. Commit or stash them first (right after /new-project, commit the scaffold + ` +
          `backlog + PRODUCT_SPEC), then re-run.`,
      );
      return;
    }

    renderer.systemMessage(`▶ Running ${task.id}: ${task.title}`);
    const result = await runOneTask(orch, task);

    // On a blocker: revert the blocked Worker's throwaway attempt so the tree is clean for the next
    // task (its review must stay isolated), then move on. The task is already marked `blocked` and the
    // question persisted; the user answers it later and re-runs. A fresh Worker redoes the work then.
    if (result?.outcome === 'blocked') {
      discardWorkingTreeChanges(orch.projectPath);
      blockedThisRun.push(task.id);
    }
  }

  if (blockedThisRun.length > 0) {
    renderer.systemMessage(
      `Run finished with ${blockedThisRun.length} blocked task(s): ${blockedThisRun.join(', ')}. ` +
        `Answer each with /answer <task-id> <text>, then /run again to retry them.`,
    );
  }
}
