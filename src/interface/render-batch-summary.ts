// REPL renderer for the end-of-batch summary (V3/05). Terminal-UX first (constitution): a compact table
// of counts, then the escalation/blocked queues the user must act on (so a morning-after glance shows
// exactly what needs attention), then the EXACT total token spend and where the report was saved. Pure
// printing; wraps naturally, no horizontal scroll. Mirrors render-verdict.ts / render-retro-result.ts.

import type { BatchSummary } from '../core/session/index.js';
import { batchSummaryFileName, BATCHES_DIRNAME } from '../core/session/index.js';
import { theme } from '../core/ui/theme.js';
import { write } from '../core/ui/write.js';
import { batchTokenLine } from './batch-token-line.js'; // exact prompt/completion counts, "not reported" for a missing one
import { describeCommits } from './describe-commits.js'; // the SHAs a task landed, comma-joined
import { firstLinePreview } from './first-line-preview.js'; // first non-empty line, capped at 120 chars

/** Render one batch's summary table. */
export function renderBatchSummary(summary: BatchSummary): void {
  write('');
  write(theme.strong(`Batch #${summary.seq} — ${summary.total} task(s) run`));

  // A pre-flight refusal or an infra fault stopped the batch early — say so loudly at the top.
  if (summary.abortedReason !== undefined) {
    write(theme.danger(`⚠ ${summary.abortedReason}`));
  }
  // A wind-down is NOT a fault: the user asked for it and everything before it ran in full, so it is
  // stated plainly rather than in the danger colour that means "something went wrong here".
  if (summary.stoppedReason !== undefined) {
    write(theme.meta(`⏸ ${summary.stoppedReason}`));
  }

  write(theme.success(`  passed     ${summary.passed.length}`));
  write(theme.danger(`  escalated  ${summary.escalated.length}`));
  write(theme.danger(`  blocked    ${summary.blocked.length}`));
  write(theme.meta(`  cancelled  ${summary.cancelled.length}`));
  write(theme.meta(`  skipped    ${summary.skipped.length}`));

  if (summary.passed.length > 0) {
    write('');
    write(theme.strong('Passed (committed):'));
    for (const p of summary.passed) {
      write(theme.success(`  ✓ ${p.taskId} — ${describeCommits(p.commits)} · ${p.rounds} round(s)`));
    }
  }

  if (summary.escalated.length > 0) {
    write('');
    write(theme.strong('Escalated (rest of the attempt stashed for you to inspect):'));
    for (const e of summary.escalated) {
      write(theme.danger(`  ⚠ ${e.taskId} — ${e.rounds} round(s) · stash: ${e.stashRef ?? '(nothing to stash)'}`));
      // The Reviewer accepts files partially, so an escalated task may still have landed work — say
      // what it kept, or the user goes looking for a clean tree that isn't there.
      if (e.commits.length > 0) write(theme.meta(`      partially accepted: ${describeCommits(e.commits)}`));
      if (e.lastFeedback.trim() !== '') write(theme.meta(`      last feedback: ${firstLinePreview(e.lastFeedback)}`));
    }
  }

  if (summary.blocked.length > 0) {
    write('');
    write(theme.strong('Blocked (awaiting your /answer — attempt stashed for Retro):'));
    for (const b of summary.blocked) {
      write(theme.danger(`  ⛔ ${b.taskId} — ${b.blockerId ?? b.taskId} · stash: ${b.stashRef ?? '(nothing to stash)'}`));
      if (b.commits.length > 0) write(theme.meta(`      partially accepted: ${describeCommits(b.commits)}`));
      if (b.question.trim() !== '') write(theme.meta(`      Q: ${firstLinePreview(b.question)}`));
      write(theme.meta(`      answer with: /answer ${b.taskId} <your answer>`));
    }
  }

  if (summary.cancelled.length > 0) {
    write('');
    write(theme.strong('Stopped by you (attempt stashed; nothing was judged):'));
    for (const c of summary.cancelled) {
      write(theme.meta(`  ⎋ ${c.taskId} — ${c.rounds} round(s) · stash: ${c.stashRef ?? '(nothing to stash)'}`));
      if (c.commits.length > 0) write(theme.meta(`      partially accepted: ${describeCommits(c.commits)}`));
      if (c.reason.trim() !== '') write(theme.meta(`      ${firstLinePreview(c.reason)}`));
      write(theme.meta(`      still pending — /run ${c.taskId} to pick it up again`));
    }
  }

  write('');
  write(batchTokenLine(summary));
  write(theme.meta(`Saved: .orchestrator/${BATCHES_DIRNAME}/${batchSummaryFileName(summary)}`));
  write('');
}
