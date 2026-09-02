// REPL renderer for the Reviewer verdict (V2/02). Terminal-UX first (constitution): a color-coded
// PASS/FAIL headline + summary, the issues grouped by severity with file + note, and the EXACT
// Reviewer token usage (never estimated — "not reported" when Ollama omitted a metric). Pure
// printing: the accept/send-back/skip decision is collected by the REPL over readline (run-repl.ts), to
// avoid fighting clack for stdin the way /run's askYesNo does. Wraps naturally — no horizontal scroll.

import type { TokenCounts } from '../core/llm/token-counts.type.js';
import type { ReviewVerdict } from '../core/session/review-verdict.type.js';
import type { Severity } from '../core/session/severity.type.js';
import { theme } from '../core/ui/theme.js';
import { write } from '../core/ui/write.js';
import { reviewerTokenLine } from './reviewer-token-line.js'; // exact prompt/eval counts, "not reported" for a missing one

/** Most-severe first, so the list reads top-down by importance. */
const SEVERITY_ORDER: readonly Severity[] = ['blocker', 'major', 'minor'];

export interface VerdictContext {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly changedCount: number;
  /** Exact tokens from the Reviewer's final turn — surfaced verbatim (nulls preserved). */
  readonly tokens: TokenCounts;
}

/** Render one Reviewer verdict: headline, summary, issues by severity, exact tokens. */
export function renderVerdict(verdict: ReviewVerdict, ctx: VerdictContext): void {
  write('');
  const badge = verdict.result === 'pass' ? theme.success(' PASS ') : theme.danger(' FAIL ');
  write(`${theme.strong('Review')} ${badge} ${theme.strong(ctx.taskId)}`);
  write(theme.meta(`${ctx.taskTitle}  ·  ${ctx.changedCount} file(s) changed`));
  write(verdict.summary);

  if (verdict.issues.length > 0) {
    write('');
    write(theme.strong('Issues:'));
    for (const severity of SEVERITY_ORDER) {
      for (const issue of verdict.issues.filter((i) => i.severity === severity)) {
        const tag = severity === 'minor' ? theme.meta(`[${severity}]`) : theme.danger(`[${severity}]`);
        const where = issue.file.trim() !== '' ? theme.strong(issue.file) : theme.meta('(no file)');
        write(`  ${tag} ${where}`);
        write(`      ${issue.note}`);
      }
    }
  }

  write(reviewerTokenLine(ctx.tokens));
  write('');
}
