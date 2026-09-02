// The body of /answer: record the user's answer to a Reviewer blocker, re-queue the task, and spawn
// the one-shot Retro window that patches the gap. Split out of answer.ts, which is now the assembler
// that registers it.
//
// Ordering matters: re-queue (setTaskStatus → pending) runs BEFORE Retro so a task-specific patch to
// the backlog file commits the body at status "pending" and leaves the project tree clean for the
// next /run.

import { BacklogError } from '../../core/session/backlog-error.js';
import { dropTaskStash } from '../../core/session/drop-task-stash.js';
import { findTask } from '../../core/session/find-task.js';
import { openBlockerForTask } from '../../core/session/open-blocker-for-task.js';
import { readBacklog } from '../../core/session/read-backlog.js';
import { readTaskStashDiff } from '../../core/session/read-task-stash-diff.js';
import { resolveBlocker } from '../../core/session/resolve-blocker.js';
import { RetroError } from '../../core/session/retro-error.js';
import { setTaskStatus } from '../../core/session/set-task-status.js';
import type { RetroInput } from '../../core/session/retro-input.type.js';
import type { RetroResult } from '../../core/session/retro-result.type.js';
import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import { renderer } from '../../core/ui/renderer.js';
import { renderRetroResult } from '../render-retro-result.js';

const USAGE = 'Usage: /answer <task-id> <answer text>';

/** The slice of the orchestrator /answer needs to spawn Retro — satisfied by SessionOrchestrator. */
export interface AnswerOrchestrator {
  readonly projectPath: string;
  // spawnRetro: the V3/03 one-shot Retro window; patches one file (systemic uncommitted / task-specific committed).
  spawnRetro(input: RetroInput): Promise<RetroResult>;
}

/**
 * Handle one `/answer` line. `rawLine` is the full REPL input (e.g. "/answer 01-foo Idempotent wins.")
 * so the answer text keeps its internal spacing (the REPL's whitespace-split would collapse it).
 */
export async function dispatchAnswer(rawLine: string, orch: AnswerOrchestrator): Promise<void> {
  const projectPath = orch.projectPath;
  // Strip the leading "/answer", then split off the FIRST token (task id) from the REST (the answer).
  const rest = rawLine.replace(/^\/answer\b\s*/i, '');
  const match = /^(\S+)\s+([\s\S]+)$/.exec(rest);
  if (match === null) {
    renderer.errorLine(USAGE);
    return;
  }
  const taskId = match[1] ?? '';
  const answer = (match[2] ?? '').trim();
  if (answer === '') {
    renderer.errorLine(USAGE);
    return;
  }

  // openBlockerForTask: the single unresolved `raised` row for this task, or undefined (a task holds
  // at most one open blocker — it can't be re-blocked until it is re-run, and only after an answer).
  const open = openBlockerForTask(projectPath, taskId);
  if (open === undefined) {
    renderer.errorLine(`No open blocker for '${taskId}'. Nothing to answer (check the task id).`);
    return;
  }

  // resolveBlocker: append the durable `resolved` row referencing the raised id.
  resolveBlocker(projectPath, { id: open.id, answer });

  // Re-queue for the next /run BEFORE Retro (so a task-specific patch commits at status "pending" and
  // the project tree stays clean). The answer is already recorded, so a missing task file (edited away)
  // must not lose it — swallow a BacklogError and confirm the answer without running Retro.
  try {
    setTaskStatus(projectPath, taskId, 'pending');
  } catch (err) {
    if (!(err instanceof BacklogError)) throw err;
    renderer.errorLine(`Recorded the answer, but couldn't re-queue '${taskId}': ${err.message}`);
    return;
  }

  // readTaskStashDiff: the failed Worker attempt stashed at block time (V3/05), as a bounded diff — advisory
  // evidence for Retro to see HOW the ambiguity misled implementation. The Worker never reuses it (a fresh
  // Worker redoes the task from scratch); absent (undefined) if nothing was stashed.
  const failedAttempt = readTaskStashDiff(projectPath, taskId) ?? undefined;

  // Spawn Retro to close the learning loop: diagnose the misunderstanding, patch the one right file.
  // Retro is best-effort — a RetroError (no edit / never submitted) must not swallow the answer, so warn
  // and continue. The task definition is what Retro reasons over; a missing task skips Retro entirely.
  const task = findTask(readBacklog(projectPath), taskId);
  if (task === undefined) {
    renderer.systemMessage(`Recorded the answer; skipped Retro ('${taskId}' is no longer in the backlog).`);
  } else {
    try {
      const result = await orch.spawnRetro({ task, misunderstanding: open.question, answer, failedAttempt });
      // renderRetroResult: scope-coded headline, root cause, patched file, and the loud systemic warning.
      renderRetroResult(result, projectPath);
    } catch (err) {
      if (!(err instanceof RetroError)) throw err;
      renderer.errorLine(`Retro couldn't patch a file: ${errMessage(err)}. Classify + patch it manually if needed.`);
    }
  }

  // The stashed attempt has served its purpose (Retro read it) and is now superseded — a fresh Worker
  // redoes the task from scratch on re-run. Drop it so stashes don't pile up (a no-op if none was stashed).
  dropTaskStash(projectPath, taskId);

  renderer.systemMessage(`✓ Answered ${open.id}. Re-run with /run ${taskId} (or /run) to retry it.`);
}
