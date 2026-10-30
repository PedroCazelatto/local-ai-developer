// The path-scoping validator (ported from tools/base.py's ToolContext.resolve). EVERY model-callable
// tool now does its file work inside the container, so the Docker mount is the security boundary;
// this is the VALIDATOR that runs first, rejecting a path that leaves the project with a message the
// model can act on, and it is the only scoping the host-side git tools (commit_changes, git_inspect)
// and the Retro single-file lock have at all.
//
// It resolves symlinks. A lexical prefix check is not enough: `execute_command` can create a link
// inside /workspace (its `..` guard is a courtesy, not a parse), that link materializes inside the
// project directory on the host, and a purely lexical `path.resolve` would then hand git a path that
// looks in-project and points anywhere. realpathSync on the deepest EXISTING ancestor closes that,
// while still validating a path whose leaf has not been created yet.

import path from 'node:path';

// Resolves a path through symlinks without requiring its leaf to exist yet.
import { realPathOfNearestExisting } from './real-path-of-nearest-existing.js';

/**
 * Join `relative` onto `projectPath` and reject any path that escapes the project root: allow only
 * the root itself or paths strictly under `root + sep`. Throws (every caller catches this and
 * returns the structured escape error) — never returns an out-of-project path.
 *
 * BOTH sides go through realPathOfNearestExisting, which resolves symlinks down to the deepest
 * ancestor that exists — so a link planted inside the project cannot present an outside target as an
 * inside path, and a file that does not exist yet still validates. The root is resolved too: the
 * comparison is meaningless if one side is real and the other lexical.
 */
export function resolveInProject(projectPath: string, relative: string): string {
  const root = realPathOfNearestExisting(projectPath);
  const resolved = realPathOfNearestExisting(path.resolve(root, relative));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path '${relative}' escapes the project directory`);
  }
  return resolved;
}
