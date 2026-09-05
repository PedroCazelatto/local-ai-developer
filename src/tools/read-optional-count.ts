// Validate one optional whole-number tool argument. Ollama hands tool arguments through as untyped
// JSON, so a model that emits "12", 12.5 or -1 must get a clean recoverable error naming the rule it
// broke rather than a slice that silently does something else.

/**
 * Either the integer (null when the caller omitted it), or the model-facing reason the value was
 * rejected. Mirrors git_inspect's own path reader — a bad argument is always a recoverable message
 * the model can act on, never a throw.
 */
export type OptionalCount =
  | { readonly ok: true; readonly value: number | null }
  | { readonly ok: false; readonly error: string };

/** `raw` as an integer of at least `minimum`; null when it was omitted; an error string when it is neither. */
export function readOptionalCount(raw: unknown, name: string, minimum: number): OptionalCount {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < minimum) {
    return { ok: false, error: `'${name}' must be a whole number of ${minimum} or more.` };
  }
  return { ok: true, value: raw };
}
