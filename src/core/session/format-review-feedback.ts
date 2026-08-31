// Turn a FAILED Reviewer verdict into a single plain-text feedback block (V3/01 fix loop). This is
// the text handed back to the SAME persistent Worker window as its next turn so it can converge:
// the overall judgment first, then every concrete issue grouped most-severe first with its file +
// fix direction. It is also what the loop returns as `lastFeedback` when a task escalates, so a
// human sees exactly why five rounds could not pass it.

import type { ReviewVerdict } from './types.js';
import { SEVERITIES } from './types.js';

/** Render a fail verdict's summary + issues (blocker→major→minor) as one actionable feedback block. */
export function formatReviewFeedback(verdict: ReviewVerdict): string {
  const lines: string[] = [verdict.summary.trim()];
  if (verdict.issues.length > 0) {
    lines.push('', 'Issues to fix:');
    for (const severity of SEVERITIES) {
      for (const issue of verdict.issues.filter((i) => i.severity === severity)) {
        const where = issue.file.trim() !== '' ? issue.file.trim() : '(no specific file)';
        lines.push(`- [${severity}] ${where}: ${issue.note.trim()}`);
      }
    }
  }
  return lines.join('\n');
}
