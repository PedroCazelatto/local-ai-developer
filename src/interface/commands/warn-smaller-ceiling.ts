// The line /resume prints after restoring a context that was written to fit a smaller window. Split
// out of resume.ts.

import type { ContextSummary } from '../../core/session/index.js';
import { theme } from '../../core/ui/theme.js';
import { write } from '../../core/ui/write.js';
import { ceilingLabel } from './ceiling-label.js';
import { isUnderSmallerCeiling } from './is-under-smaller-ceiling.js';
import { WARN_GLYPH } from './warn-glyph.js';

/**
 * Say that the context just restored was written to fit a smaller window. It NAMES BOTH CEILINGS on
 * purpose: "written under a smaller window" is not diagnosable, and "written under 8,192 while this
 * session runs at 16,384" tells the user exactly which change of theirs explains the shorter history
 * they are looking at. It reads as a warning, not a failure, because nothing failed — the replay is
 * safe, and that is the second line's job to say.
 *
 * A no-op when the ceilings match, so the caller needs no guard of its own.
 */
export function warnSmallerCeiling(context: ContextSummary, sessionNumCtx: number): void {
  // isUnderSmallerCeiling: the same predicate the listing marks a row with, so the mark and this
  // warning cannot disagree about which contexts are affected.
  if (!isUnderSmallerCeiling(context, sessionNumCtx)) return;
  write(
    theme.danger(
      `${WARN_GLYPH} Written under OLLAMA_NUM_CTX ${ceilingLabel(context.numCtx)}; this session runs at ${ceilingLabel(sessionNumCtx)}.`,
    ),
  );
  write(theme.meta('  Safe to replay — a smaller history fits a larger window — but it was written to fit the smaller one.'));
}
