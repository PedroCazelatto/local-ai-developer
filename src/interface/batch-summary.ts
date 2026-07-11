// REPL renderer for the end-of-batch summary (V3/05). Terminal-UX first (constitution): a compact table
// of counts, then the escalation/blocked queues the user must act on (so a morning-after glance shows
// exactly what needs attention), then the EXACT total token spend and where the report was saved. Pure
// printing; wraps naturally, no horizontal scroll. Mirrors review-prompt.ts / retro-prompt.ts.

import type { BatchSummary } from '../core/session/index.js';
import { batchSummaryFileName, BATCHES_DIRNAME } from '../core/session/index.js';
import { theme } from '../core/ui/theme.js';

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** First non-empty line of a multi-line message, trimmed to `max` chars (feedback / blocker question). */
function firstLine(text: string, max = 120): string {
  const line = (text.split('\n').find((l) => l.trim() !== '') ?? '').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Exact token line — never a length estimate; says "not reported" when a metric was omitted (constitution). */
function tokenLine(summary: BatchSummary): string {
  const prompt = summary.tokens.promptTokens === null ? 'not reported' : String(summary.tokens.promptTokens);
  const evalT = summary.tokens.evalTokens === null ? 'not reported' : String(summary.tokens.evalTokens);
  return theme.meta(`Tokens (exact, summed over every task's loop) — prompt: ${prompt}, completion: ${evalT}`);
}

/** Render one batch's summary table. */
export function renderBatchSummary(summary: BatchSummary): void {
  write('');
  write(theme.strong(`Batch #${summary.seq} — ${summary.total} task(s) run`));

  // A pre-flight refusal or an infra fault stopped the batch early — say so loudly at the top.
  if (summary.abortedReason !== undefined) {
    write(theme.danger(`⚠ ${summary.abortedReason}`));
  }

  write(theme.success(`  passed     ${summary.passed.length}`));
  write(theme.danger(`  escalated  ${summary.escalated.length}`));
  write(theme.danger(`  blocked    ${summary.blocked.length}`));
  write(theme.meta(`  skipped    ${summary.skipped.length}`));

  if (summary.passed.length > 0) {
    write('');
    write(theme.strong('Passed (committed):'));
    for (const p of summary.passed) {
      write(theme.success(`  ✓ ${p.taskId} — ${p.commit ?? '(no sha)'} · ${p.rounds} round(s)`));
    }
  }

  if (summary.escalated.length > 0) {
    write('');
    write(theme.strong('Escalated (uncommitted — attempt stashed for you to inspect):'));
    for (const e of summary.escalated) {
      write(theme.danger(`  ⚠ ${e.taskId} — ${e.rounds} round(s) · stash: ${e.stashRef ?? '(nothing to stash)'}`));
      if (e.lastFeedback.trim() !== '') write(theme.meta(`      last feedback: ${firstLine(e.lastFeedback)}`));
    }
  }

  if (summary.blocked.length > 0) {
    write('');
    write(theme.strong('Blocked (awaiting your /answer — attempt stashed for Retro):'));
    for (const b of summary.blocked) {
      write(theme.danger(`  ⛔ ${b.taskId} — ${b.blockerId ?? b.taskId} · stash: ${b.stashRef ?? '(nothing to stash)'}`));
      if (b.question.trim() !== '') write(theme.meta(`      Q: ${firstLine(b.question)}`));
      write(theme.meta(`      answer with: /answer ${b.taskId} <your answer>`));
    }
  }

  write('');
  write(tokenLine(summary));
  write(theme.meta(`Saved: .orchestrator/${BATCHES_DIRNAME}/${batchSummaryFileName(summary)}`));
  write('');
}
