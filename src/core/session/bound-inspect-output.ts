// The one place a git_inspect result is bounded, shared by diff / log / show so all three report a cut
// the same way. Extracted from project-git-inspect.ts, where it was the private `bounded` — a name
// that says nothing on its own in a flat folder.

import { truncateHeadTailToTokens } from '../../tools/truncate-head-tail-to-tokens.js';
import type { InspectResult } from './inspect-result.type.js';

/** Bound `output` to `budget` estimated tokens, reporting whether anything was cut. */
export function boundInspectOutput(output: string, budget: number): InspectResult {
  const trimmed = output.trim();
  // truncateHeadTailToTokens: keeps the head and the tail and elides the middle, to fit `budget` tokens.
  const cut = truncateHeadTailToTokens(trimmed, budget);
  return { ok: true, output: cut, truncated: cut.length !== trimmed.length };
}
