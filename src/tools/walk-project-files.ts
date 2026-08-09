// walkProjectFiles — yield every regular file under a directory, depth-first, skipping the
// heavy/generated trees. Split out of search-in-files.ts so that file holds only its tool.
//
// The skip list is not an optimization, it is the difference between a usable search and an unusable
// one: after a single `npm i`, node_modules alone holds more matches than any cap allows, so an
// unfiltered walk spends the whole match budget inside vendored code before reaching src/.

import { readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';

/** Trees never worth searching: version control, virtualenvs, dependencies, build output. */
export const SKIP_DIRS: ReadonlySet<string> = new Set([
  '.git',
  '__pycache__',
  'node_modules',
  '.venv',
  'venv',
  'dist',
  'build',
]);

/**
 * Every regular file under `dir`, recursively, with SKIP_DIRS pruned. Absolute host paths.
 *
 * An unreadable directory is skipped SILENTLY rather than failing the walk — a permission-denied
 * subtree is a normal condition on a project tree, and one bad directory must not cost the model the
 * matches in every other directory. (This keeps the Python port's OSError tolerance.)
 */
export function* walkProjectFiles(dir: string): Generator<string> {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walkProjectFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}
