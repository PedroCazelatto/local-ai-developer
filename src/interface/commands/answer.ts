// /answer <task-id> <text> (V3/02 + V3/03) — the user resolves a blocker the Reviewer raised. It
// records the answer as a durable `resolved` row (blockers.jsonl), re-queues the task (blocked →
// pending) so the NEXT /run retries it with a fresh Worker, and then spawns the one-shot Retro window
// (V3/03) to diagnose the misunderstanding and patch the offending file so it can't recur. It
// deliberately does NOT restart the loop: /run is synchronous, so the user only reaches this prompt
// while the loop is stopped; they answer every blocker, then run /run again themselves.
//
// Ordering matters: re-queue (setTaskStatus → pending) runs BEFORE Retro so a task-specific patch to the
// backlog file commits the body at status "pending" and leaves the project tree clean for the next /run.

import {
  allTasks,
  BacklogError,
  dropTaskStash,
  findTask,
  openBlockerForTask,
  readBacklog,
  readTaskStashDiff,
  resolveBlocker,
  RetroError,
  setTaskStatus,
} from '../../core/session/index.js';
import type { RetroInput, RetroResult } from '../../core/session/index.js';
import * as renderer from '../../core/ui/renderer.js';
import { renderRetroResult } from '../retro-prompt.js';
import type { Command, CompletionContext } from '../command-registry.js';

const USAGE = 'Usage: /answer <task-id> <answer text>';

/** The slice of the orchestrator /answer needs to spawn Retro — satisfied by SessionOrchestrator. */
export interface AnswerOrchestrator {
  readonly projectPath: string;
  // spawnRetro: the V3/03 one-shot Retro window; patches one file (systemic uncommitted / task-specific committed).
  spawnRetro(input: RetroInput): Promise<RetroResult>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Handle one `/answer` line. `rawLine` is the full REPL input (e.g. "/answer 01-foo Idempotent wins.")
 * so the answer text keeps its internal spacing (the REPL's whitespace-split would collapse it).
 */
async function dispatchAnswer(rawLine: string, orch: AnswerOrchestrator): Promise<void> {
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
      renderer.errorLine(`Retro couldn't patch a file: ${messageOf(err)}. Classify + patch it manually if needed.`);
    }
  }

  // The stashed attempt has served its purpose (Retro read it) and is now superseded — a fresh Worker
  // redoes the task from scratch on re-run. Drop it so stashes don't pile up (a no-op if none was stashed).
  dropTaskStash(projectPath, taskId);

  renderer.systemMessage(`✓ Answered ${open.id}. Re-run with /run ${taskId} (or /run) to retry it.`);
}

/**
 * Tab candidates for `/answer <task-id>`: ONLY tasks sitting at `blocked`, which is exactly the set this
 * command can act on — an id with no open blocker is rejected below, so offering more would just invite
 * that error. Everything past the id is free-text answer prose.
 */
function completeAnswer(ctx: CompletionContext): string[] {
  if (ctx.args.length > 0) return [];
  try {
    // readBacklog is a SYNC file read — safe inside a completer that must never await (complete-line.ts).
    // No backlog (or an unreadable one) simply means no ids to offer, never a thrown Tab.
    return allTasks(readBacklog(ctx.orch.projectPath))
      .filter((t) => t.status === 'blocked')
      .map((t) => t.id);
  } catch {
    return [];
  }
}

export const answerCommand: Command = {
  name: 'answer',
  group: 'execution',
  description: 'Resolve a Reviewer blocker; re-queues the task and spawns Retro to patch the gap',
  usage: '/answer <task-id> <answer text>',
  complete: completeAnswer,
  // ctx.raw is the line minus its leading slash; re-add it so dispatchAnswer's own `/answer` strip and
  // the answer text's internal spacing are preserved (the whitespace-split ctx.args would collapse it).
  run: (ctx) => dispatchAnswer(`/${ctx.raw}`, ctx.orch),
};
