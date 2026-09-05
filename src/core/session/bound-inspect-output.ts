// The one place a git_inspect result is bounded, shared by diff / log / show so all three report a cut
// the same way. Extracted from project-git-inspect.ts, where it was the private `bounded` — a name
// that says nothing on its own in a flat folder.

import { truncateHeadTail } from '../../tools/truncate.js';
import type { InspectResult } from './types.js';

/** Bound `output` to `budget`, reporting whether anything was cut. */
export function boundInspectOutput(output: string, budget: number): InspectResult {
  const trimmed = output.trim();
  // truncateHeadTail: keeps the head and the tail of the text and elides the middle, to fit `budget`.
  const cut = truncateHeadTail(trimmed, budget);
  return { ok: true, output: cut, truncated: cut.length !== trimmed.length };
}
