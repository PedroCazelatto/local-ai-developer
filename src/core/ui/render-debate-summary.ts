// The single line that closes a debate in the scrollback: how many rounds it ran, where it landed, and
// what it cost. Dim, like every other meta line — the argument above it is the content.
//
// The token figure is the EXACT summed count and is printed in full (`3,412 tokens`), never rounded to
// a friendlier `3.4k`: this is the one place a debate's cost is visible to the user, and the whole
// project reads token figures literally (constitution — see also /subagents and the batch summary).

import type { DebateSummaryView } from './render-debate-summary.type.js';
import * as renderer from './renderer.js';
import { theme } from './theme.js';

/** Print `⟨debate⟩ 2 rounds · claim did not survive · challenger conceded · 3,412 tokens`. */
export function renderDebateSummary(view: DebateSummaryView): void {
  const parts = [
    `${view.rounds} ${view.rounds === 1 ? 'round' : 'rounds'}`,
    verdict(view.survived),
    ...(view.conceded ? ['challenger conceded'] : []),
    cost(view.promptTokens, view.evalTokens),
  ];
  // interjectLine, not a direct write: a debate closes inside a tool call, where the transient activity
  // line owns the cursor row (see render-debate-turn.ts).
  renderer.interjectLine(theme.meta(`⟨debate⟩ ${parts.join(' · ')}`));
}

/** The verdict as prose. A null digest says so — it never becomes "did not survive" by default. */
function verdict(survived: boolean | null): string {
  if (survived === null) return 'no digest';
  return survived ? 'claim survived' : 'claim did not survive';
}

/** The exact total, or "tokens not reported" when Ollama omitted a metric on any call in the debate. */
function cost(promptTokens: number | null, evalTokens: number | null): string {
  if (promptTokens === null || evalTokens === null) return 'tokens not reported';
  return `${(promptTokens + evalTokens).toLocaleString('en-US')} tokens`;
}
