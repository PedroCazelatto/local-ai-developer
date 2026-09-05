// One task's terminal outcome, as /run reports it — passed, blocked, stopped or escalated. Split out
// of run.ts, where it was the private `renderOutcome`; the bare noun would not have said whose
// outcome in a folder that also renders help, a task tree and a batch summary.
//
// The four branches deliberately differ in TONE as well as text: a stop is the user's own act and
// reads as a plain system line, while an escalation is a fault the user has to act on and reads as an
// error. Each says what is already committed, because a Reviewer commits in pieces and "the rest is
// uncommitted" is only useful next to what is not.

import type { TaskLoopResult } from '../../core/session/run-task-loop.js';
import { renderer } from '../../core/ui/renderer.js';
import { tokenCostLine } from './token-cost-line.js';

/** Render one task's terminal outcome: passed (committed), blocked (question), or escalated (feedback). */
export function renderTaskOutcome(result: TaskLoopResult): void {
  // tokenCostLine: the EXACT prompt/completion totals, or "not reported" for a metric Ollama omitted.
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
