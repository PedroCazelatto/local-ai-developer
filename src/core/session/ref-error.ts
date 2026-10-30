// Validation for a revision the MODEL chose, before it reaches an argv.

/**
 * Why `ref` is unusable, or null when it is fine. A leading '-' is the one that matters: it would be
 * read as an OPTION in the argv rather than as a revision, which is how a read-only tool would stop
 * being read-only.
 */
export function refError(ref: string): string | null {
  if (ref.trim() === '') return "'ref' must not be empty.";
  if (ref.startsWith('-')) return `'${ref}' is not a valid revision — it must not start with '-'.`;
  return null;
}
