// Resolve one Tab press into a concrete edit of the input line. Tab CYCLES, the way a file completion
// does in cmd.exe or fish: the first press swaps the word under the cursor for the first candidate, each
// further press replaces it with the next one, and the press after the last wraps back to the first.
//
// Cycling is what lets completion exist here at all. The alternative — extend to the longest common
// prefix, then show the choice — needs somewhere to PUT that list, and the only surfaces available are
// the append-only scrollback (a print between the transient input rule and the input line puts the rule
// beyond the reach of renderer's erase math, stranding it in history) or the pinned status rows (one row,
// which a couple of full task ids overflow). Cycling prints nothing at all, so neither problem arises.
// Every press instead changes the line itself, which is also what makes the cycle readable.
//
// The catalog of WHAT completes where stays in complete-line.ts; this file owns only the stepping.

import { completeLine } from './complete-line.js';
import type { CompletionCycle, CompletionInput, CompletionStep } from './cycle-completion.type.js';

/** Swap the cycle's current candidate into `line` in place of the word spanning [start, end). */
function replaceWord(line: string, start: number, end: number, cycle: CompletionCycle): CompletionStep {
  const word = cycle.candidates[cycle.index] ?? '';
  return { line: line.slice(0, start) + word + line.slice(end), cursor: start + word.length, cycle };
}

/**
 * The next step of the Tab cycle, or null when there is nothing to complete — a chat line, an unknown
 * command, or an argument position the command offers no candidates for. A null also means "no cycle":
 * the caller drops whatever it was holding.
 *
 * Synchronous by contract, and complete-line.ts explains why: this runs inline in the keypress handler.
 */
export function cycleCompletion(input: CompletionInput): CompletionStep | null {
  const { line, cursor, active } = input;

  // Continue the cycle in flight — but only if the line still looks EXACTLY as this function left it:
  // the candidate it inserted still sitting at `start`, with the cursor at that word's end. The REPL
  // already drops the cycle on any non-Tab key; this is the second half of the same guard, and it is the
  // half that survives a line changed some other way (a queued message drained into the prompt, a resize
  // reflow). Without it a stale cycle would overwrite a span of text the user has since retyped.
  if (active !== null) {
    const current = active.candidates[active.index] ?? '';
    const end = active.start + current.length;
    if (cursor === end && line.slice(active.start, end) === current) {
      const index = (active.index + 1) % active.candidates.length;
      return replaceWord(line, active.start, end, { ...active, index });
    }
  }

  // A fresh cycle. completeLine takes the line up to the CURSOR and returns every candidate for the word
  // being typed there, already filtered to it and alphabetized — the stable order the cycle walks.
  const [candidates, partial] = completeLine(line.slice(0, cursor), input.orch);
  if (candidates.length === 0) return null;
  const start = cursor - partial.length;
  return replaceWord(line, start, cursor, { candidates, index: 0, start });
}
