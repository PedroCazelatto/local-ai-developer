// Coerce one ask_user question's `options` into a list of non-empty strings.
//
// A JSON-string list is tolerated, for the reason extract-question-list.ts gives. A NON-STRING member
// fails the whole list rather than being dropped: a model that sent `[1, 2]` meant something by it,
// and silently returning an empty option set would surface as the wrong error.
//
// Blank strings ARE dropped rather than failing, which is what makes the caller's minimum-options
// check meaningful: `["yes", ""]` is one real choice, not two.

import { loadsOrRepair } from '../core/llm/index.js';

/** Coerce one entry's options into a list of non-empty strings, tolerating a JSON-string list. */
export function extractQuestionOptions(value: unknown): string[] | null {
  const list = typeof value === 'string' ? loadsOrRepair(value) : value;
  if (!Array.isArray(list)) return null;
  const options: string[] = [];
  for (const option of list) {
    if (typeof option !== 'string') return null;
    const trimmed = option.trim();
    if (trimmed !== '') options.push(trimmed);
  }
  return options;
}
