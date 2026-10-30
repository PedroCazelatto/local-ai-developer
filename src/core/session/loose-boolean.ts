// A boolean a local model actually wrote.
//
// Accepts a real JSON boolean, and the strings "true"/"false" — a local model writes a verdict quoted
// often enough that rejecting it would throw away a digest whose meaning is unambiguous. Everything
// else is null, including "yes", "partly" and a number: those are verdicts this code REFUSES to
// interpret rather than guesses at.
//
// Named looseBoolean rather than the module-private `asBoolean` it was extracted from, because the
// tolerance is the whole point of the function and the old name hid it.

/** A real JSON boolean, or the strings "true"/"false". Anything else is null — never a default. */
export function looseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return null;
}
