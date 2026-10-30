// The numbered context list a bare /resume prints. Split out of resume.ts, where it was the private
// `renderList` — a name that as a file name would not have said WHICH list.

import type { ContextSummary } from '../../core/session/context-summary.type.js';
import { capitalizePhase } from '../../core/ui/capitalize-phase.js';
import { theme } from '../../core/ui/theme.js';
import { write } from '../../core/ui/write.js';
import { ceilingLabel } from './ceiling-label.js';
import { contextAddress } from './context-address.js';
import { formatLocalStamp } from './format-local-stamp.js';
import { isUnderSmallerCeiling } from './is-under-smaller-ceiling.js';
import { turnLabel } from './turn-label.js';
import { WARN_GLYPH } from './warn-glyph.js';

/**
 * Render the numbered context list (1-based). Each entry: address · last activity · turns · tokens ·
 * the model(s) that wrote it, then the title on its own line. An untitled context says so plainly —
 * it produced no prose answer for the title writer to describe, and inventing a description from its
 * raw first message is exactly what the title replaced.
 *
 * A context written under a smaller ceiling carries a marked fact of its own, and the list closes with
 * the legend explaining it — the `/models list` shape, where the mark sits on the row and the meaning
 * sits once at the bottom. The legend also states what is NOT in the list, for the same reason
 * `/models list` shows toolless models rather than dropping them: a listing should explain its own
 * omissions instead of leaving the user to wonder where a context went.
 */
export function renderContextList(phase: string, contexts: readonly ContextSummary[], sessionNumCtx: number): void {
  // write: the raw stdout row a hand-painted table is built out of (deliberately not a renderer line).
  write('');
  // capitalizePhase: phase ids are lowercase in-code; display them Titlecased.
  write(theme.strong(`Contexts for ${capitalizePhase(phase)} (most recent first):`));
  write('');
  contexts.forEach((context, i) => {
    const facts = [
      // contextAddress: `design/7a888b1f` — the same form `/resume <address>` accepts.
      theme.strong(contextAddress(context)),
      // formatLocalStamp: the stored UTC stamp on the reader's own wall clock.
      formatLocalStamp(context.lastActivityAt),
      turnLabel(context.turnCount),
      `${context.totalTokens.toLocaleString('en-US')} tokens`,
      ...(context.models.length > 0 ? [context.models.join(' + ')] : []),
      // isUnderSmallerCeiling: written to fit a smaller window than this session runs — safe, but marked.
      ...(isUnderSmallerCeiling(context, sessionNumCtx)
        ? [theme.danger(`${WARN_GLYPH} num_ctx ${ceilingLabel(context.numCtx)}`)]
        : []),
    ];
    write(`  ${i + 1}) ${facts.join(' · ')}`);
    write(context.title === null ? theme.meta('     (untitled)') : theme.meta(`     "${context.title}"`));
    write('');
  });
  if (!contexts.some((context) => isUnderSmallerCeiling(context, sessionNumCtx))) return;
  write(
    theme.meta(`  ${WARN_GLYPH} written under a smaller OLLAMA_NUM_CTX than this session's ${ceilingLabel(sessionNumCtx)} — safe to reopen.`),
  );
  write(theme.meta('  Anything written under a LARGER ceiling stays hidden: replaying it would silently drop its oldest turns.'));
  write('');
}
