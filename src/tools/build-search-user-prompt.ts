// The throwaway user turn search_rules sends: the whole catalog as `name: description` lines, then
// the intent, then the instruction to answer with names only.
//
// The catalog rides in the USER turn rather than the system prompt on purpose (V4/02): the system
// prompt is kept short and stable while the catalog grows, and none of this ever enters the calling
// phase's memory — the call is history-free and discarded.

import type { StandardEntry } from '../context/load-catalog.js';

/** Assemble the throwaway user turn: one `name: description` line per standard, then the intent. */
export function buildSearchUserPrompt(catalog: StandardEntry[], intent: string): string {
  const lines = catalog.map((entry) => `${entry.name}: ${entry.description}`).join('\n');
  return `Catalog:\n${lines}\n\nIntent: ${intent}\n\nReturn ONLY a JSON array of matching names drawn from the catalog above.`;
}
