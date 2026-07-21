// Resolve a Tab press into a concrete action (repl.ts owns readline; this owns the LOGIC). We drive
// completion ourselves rather than through readline's built-in completer so the candidate list is a
// transient widget — shown once, never spilled into scrollback — instead of readline's inline print.
//
// completeLine (still the single source of truth for WHAT completes where) returns the candidate words
// already filtered to what's typed and the partial word being typed. From those we derive: how far to
// safely extend (the shared prefix, minus what's already there) and whether there is still a choice to
// show the user.

import { completeLine } from './complete-line.js';
import { longestCommonPrefix } from './longest-common-prefix.js';
import type { CompleteAction } from './complete-action.type.js';
import type { ReplOrchestrator } from './repl.js';

/** Resolve the completion at `lineToCursor` (the line up to the cursor) into an insert + a list to show. */
export function completeAction(lineToCursor: string, orch: ReplOrchestrator): CompleteAction {
  // completeLine: candidates (full words starting with `partial`, sorted) + the partial word typed.
  const [candidates, partial] = completeLine(lineToCursor, orch);
  if (candidates.length === 0) return { extend: '', candidates: [] };
  if (candidates.length === 1) {
    const only = candidates[0] ?? '';
    return { extend: only.slice(partial.length), candidates: [] }; // lone match: finish it, nothing to list
  }
  // Ambiguous: extend as far as every candidate agrees, then show the remaining choice.
  const prefix = longestCommonPrefix(candidates);
  return { extend: prefix.slice(partial.length), candidates };
}
