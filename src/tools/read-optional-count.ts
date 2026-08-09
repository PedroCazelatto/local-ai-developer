// Validate one optional whole-number tool argument. Ollama hands tool arguments through as untyped
// JSON, so a model that emits "12", 12.5 or -1 must get a clean recoverable error naming the rule it
// broke rather than a slice that silently does something else.

import type { OptionalCount } from './read-optional-count.type.js';

/** `raw` as an integer of at least `minimum`; null when it was omitted; an error string when it is neither. */
export function readOptionalCount(raw: unknown, name: string, minimum: number): OptionalCount {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < minimum) {
    return { ok: false, error: `'${name}' must be a whole number of ${minimum} or more.` };
  }
  return { ok: true, value: raw };
}
