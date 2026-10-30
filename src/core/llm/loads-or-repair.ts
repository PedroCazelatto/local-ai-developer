// Whole-string tolerant JSON parse — the form every caller outside this folder wants. The partial
// decode it falls back to lives in repair-decode.ts; this adds the "and nothing but the object"
// condition, which is what makes it safe to hand a whole model reply to.

import { repairDecode } from './repair-decode.js';

/**
 * `JSON.parse` with the repair pass as fallback. Returns the parsed value or `null`. The
 * repaired parse must consume the whole text (modulo trailing whitespace) to count.
 */
export function loadsOrRepair(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // fall through to the repair pass
  }
  const trimmed = text.trim();
  // repairDecode parses ONE object off the front, escaping literal control characters inside strings,
  // and reports how many characters it consumed.
  const decoded = repairDecode(trimmed);
  if (decoded === null) return null;
  if (trimmed.slice(decoded.consumed).trim() !== '') {
    return null;
  }
  return decoded.value;
}
