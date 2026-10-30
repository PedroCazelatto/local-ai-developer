// Keep only the standard names that really exist in the catalog.
//
// The reply this reads is UNTRUSTED: search_rules hands the catalog to a throwaway model call and a
// hallucinated name must never be passed on to load_rule, because the model would then reason about a
// document that does not exist. So membership is checked against the catalog rather than assumed, a
// non-string member of a mixed array is dropped, and an empty result is a valid answer.
//
// Order is PRESERVED and duplicates removed, which matters because the names go into the scrollback
// line and then into the model's next call: the same search must read back the same way twice.
//
// `validateStandardNames` rather than `validateMatches` -- matches of what was the one thing the old
// name did not say.

// Best-effort JSON array out of a fenced or prose-wrapped reply; [] when there is none.
import { extractJsonArray } from './extract-json-array.js';

/**
 * Parse the model's UNTRUSTED reply as a JSON array of strings and keep only catalog-valid, deduped
 * names (order preserved). Non-array / non-JSON output → [] (never a thrown error): the model may
 * legitimately match nothing, and a malformed reply must not kill the turn.
 */
export function validateStandardNames(content: string, valid: ReadonlySet<string>): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();
  for (const item of extractJsonArray(content)) {
    if (typeof item !== 'string') continue; // drop non-strings from a mixed array
    const name = item.trim();
    if (valid.has(name) && !seen.has(name)) {
      seen.add(name);
      matches.push(name);
    }
  }
  return matches;
}
