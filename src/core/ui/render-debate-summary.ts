// The single line that closes a debate in the scrollback: how many rounds it ran, where it landed, and
// what it cost. Dim, like every other meta line — the argument above it is the content.
//
// The token figure is the EXACT summed count and is printed in full (`3,412 tokens`), never rounded to
// a friendlier `3.4k`: this is the one place a debate's cost is visible to the user, and the whole
// project reads token figures literally (constitution — see also /subagents and the batch summary).

import { debateCostText } from './debate-cost-text.js';
import { debateVerdictText } from './debate-verdict-text.js';
import * as renderer from './renderer.js';
import { theme } from './theme.js';

/**
 * The view this file prints. Declared here rather than imported from core/session, so ui/ stays a leaf
 * (see render-debate-turn.ts).
 */
export interface DebateSummaryView {
  /** Completed rounds. */
  readonly rounds: number;
  /** True when the challenger conceded before the cap — worth stating: it means the claim held. */
  readonly conceded: boolean;
  /** The verdict, or null when no digest could be read — printed as such, never as a guessed verdict. */
  readonly survived: boolean | null;
  /** EXACT Ollama counts for the whole debate; a null metric prints as "not reported", never as 0. */
  readonly promptTokens: number | null;
  readonly evalTokens: number | null;
}

/** Print `⟨debate⟩ 2 rounds · claim did not survive · challenger conceded · 3,412 tokens`. */
export function renderDebateSummary(view: DebateSummaryView): void {
  const parts = [
    `${view.rounds} ${view.rounds === 1 ? 'round' : 'rounds'}`,
    // debateVerdictText: `claim survived` / `claim did not survive` / `no digest`.
    debateVerdictText(view.survived),
    ...(view.conceded ? ['challenger conceded'] : []),
    // debateCostText: the exact summed token total, or `tokens not reported`.
    debateCostText(view.promptTokens, view.evalTokens),
  ];
  // interjectLine, not a direct write: a debate closes inside a tool call, where the transient activity
  // line owns the cursor row (see render-debate-turn.ts).
  renderer.interjectLine(theme.meta(`⟨debate⟩ ${parts.join(' · ')}`));
}
