// The FALLBACK half of list_files' hiding rule: is any segment of this path a directory nobody wants
// listed?
//
// It only decides anything when the project has no .gitignore -- a project before its first commit,
// or one that never had one. The set it consults is search_in_files' SKIP_DIRS, deliberately, so that
// "what the model can see" does not depend on which inspection tool it reached for.
//
// Any SEGMENT, not just the first: `packages/web/node_modules/x` is hidden as surely as
// `node_modules/x`.

// The trees search_in_files already refuses to walk.
import { SKIP_DIRS } from './skip-dirs.js';

/** True when any segment of `path` is a directory nobody wants listed. */
export function hasSkippedSegment(path: string): boolean {
  return path.split('/').some((segment) => SKIP_DIRS.has(segment));
}
