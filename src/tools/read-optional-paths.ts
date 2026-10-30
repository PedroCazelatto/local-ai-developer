// Validate git_inspect's `paths` argument, where the list is a FILTER and absence means "no filter".
//
// The counterpart of read-required-paths.ts, and kept separate from it for the reason that file's
// header gives: the difference is an invariant rather than a flag. Here an omitted or null `paths` is
// an empty list and a legitimate whole-repo request; a non-array is still refused, because a model
// that sent a string meant something by it.

// Backslashes to forward slashes, trailing slash removed. NOT core/session's toPosixTrimmed.
import { toPosixNoTrailingSlash } from './to-posix-no-trailing-slash.js';

/** Validate `paths` into a clean posix list, or return the model-facing reason it isn't one. */
export function readOptionalPaths(raw: unknown): { readonly ok: true; readonly paths: string[] } | { readonly ok: false; readonly error: string } {
  if (raw === undefined || raw === null) return { ok: true, paths: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "'paths' must be an array of project-relative file paths." };
  const paths: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      return { ok: false, error: "every entry in 'paths' must be a non-empty string." };
    }
    const normalized = toPosixNoTrailingSlash(entry.trim());
    if (normalized !== '' && !paths.includes(normalized)) paths.push(normalized);
  }
  return { ok: true, paths };
}
