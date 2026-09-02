// Validate commit_changes' `paths` argument, where the list is MANDATORY.
//
// It is one of two path readers in this directory and they are deliberately two functions, not one
// behind a flag. The difference is an invariant, not an option: commit_changes stages exactly what it
// is given, so an absent or empty list is a call that means nothing and must come back as an error.
// read-optional-paths.ts treats absence as "no filter" because for git_inspect that is a legitimate
// whole-repo request. A boolean parameter would push that judgement out to every call site, which is
// where it would eventually be got wrong.

// Backslashes to forward slashes, trailing slash removed. NOT core/session's toPosixTrimmed.
import { toPosixNoTrailingSlash } from './to-posix-no-trailing-slash.js';

/** Validate the `paths` argument into a clean posix list, or return the model-facing reason it isn't one. */
export function readRequiredPaths(raw: unknown): { readonly ok: true; readonly paths: string[] } | { readonly ok: false; readonly error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "'paths' must be a non-empty array of project-relative file paths." };
  }
  const paths: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return { ok: false, error: "every entry in 'paths' must be a non-empty string." };
    }
    const normalized = toPosixNoTrailingSlash(entry.trim());
    if (normalized !== '' && !paths.includes(normalized)) paths.push(normalized);
  }
  return paths.length === 0 ? { ok: false, error: "'paths' contained no usable path." } : { ok: true, paths };
}
