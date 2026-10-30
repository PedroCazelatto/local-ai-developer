// Normalise a model-supplied path for the host-side git tools: backslashes to forward slashes, and
// any trailing slash removed.
//
// The name is long on purpose. This was `toPosix` in commit-changes.ts and again in git-inspect.ts,
// and src/core/session/to-posix-trimmed.ts is a THIRD function that also used to be called `toPosix`
// -- and neither is a superset of the other. That one trims whitespace and keeps trailing slashes;
// this one strips trailing slashes and keeps whitespace, which is why commit_changes writes
// `toPosixNoTrailingSlash(entry.trim())` and makes up the difference at the call site. While both
// were private the collision was invisible; as file names it would have been two modules a reader
// could not tell apart, so both lost the plain name for one that says what they do.
//
// A trailing slash goes because git speaks paths, not directories: `src/auth/` and `src/auth` are the
// same pathspec to git but different strings to the `includes` check that decides whether a named
// path is actually among the uncommitted ones.

/** git speaks forward slashes on every platform; accept whatever separator the model emitted. */
export function toPosixNoTrailingSlash(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}
