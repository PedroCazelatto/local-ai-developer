// The one edit a Tab press makes to the input line: swap the word under the cursor for the cycle's
// current candidate. Extracted from cycle-completion.ts, which owns the stepping; this owns the splice.
//
// The type-only import from cycle-completion.js is the reverse of that file's value import of this one.
// It erases at compile time, so nothing circular survives into the runtime graph.

import type { CompletionStep } from './cycle-completion.js';
import type { CompletionCycle } from './completion-cycle.type.js';

/** Swap the cycle's current candidate into `line` in place of the word spanning [start, end). */
export function replaceWord(line: string, start: number, end: number, cycle: CompletionCycle): CompletionStep {
  const word = cycle.candidates[cycle.index] ?? '';
  return { line: line.slice(0, start) + word + line.slice(end), cursor: start + word.length, cycle };
}
