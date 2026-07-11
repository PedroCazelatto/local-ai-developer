// /answer <task-id> <text> (V3/02) — the user resolves a blocker the Reviewer raised. It records the
// answer as a durable `resolved` row (blockers.jsonl) and re-queues the task (blocked → pending) so
// the NEXT /run retries it with a fresh Worker (the blocked attempt was reverted). It deliberately
// does NOT restart the loop: /run is synchronous, so the user only reaches this prompt while the loop
// is stopped; they answer every blocker, then run /run again themselves.
//
// (V3/03 will spawn the Retro phase here — diagnosing the misunderstanding and patching the offending
// file — between recording the answer and the re-run. For now the answer is just recorded + re-queued.)

import { BacklogError, openBlockerForTask, resolveBlocker, setTaskStatus } from '../../core/session/index.js';
import * as renderer from '../../core/ui/renderer.js';

const USAGE = 'Usage: /answer <task-id> <answer text>';

/**
 * Handle one `/answer` line. `rawLine` is the full REPL input (e.g. "/answer 01-foo Idempotent wins.")
 * so the answer text keeps its internal spacing (the REPL's whitespace-split would collapse it).
 */
export function answerCommand(rawLine: string, projectPath: string): void {
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

  // Re-queue for the next /run. The answer is already recorded, so a missing task file (edited away)
  // must not lose it — swallow a BacklogError from the status flip and still confirm the answer.
  try {
    setTaskStatus(projectPath, taskId, 'pending');
  } catch (err) {
    if (!(err instanceof BacklogError)) throw err;
    renderer.errorLine(`Recorded the answer, but couldn't re-queue '${taskId}': ${err.message}`);
    return;
  }

  renderer.systemMessage(`✓ Answered ${open.id}. Re-run with /run ${taskId} (or /run) to retry it.`);
}
