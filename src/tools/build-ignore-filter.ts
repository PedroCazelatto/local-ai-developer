// buildIgnoreFilter — decide what list_files does NOT show. A listing that is mostly node_modules is
// technically honest and practically useless; it spends the window the listing exists to save.
//
// The project's own .gitignore is the source of truth, matched by the `ignore` package (git's own
// semantics: negation, anchoring, `dir/`, `**`). Two deliberate departures from "just run git":
//
//   - It is READ AS A FILE, out of the container, never `git check-ignore`. A read-only inspection
//     tool must not depend on git state, and — the load-bearing half — a file the model has just
//     written but not committed must never be hidden from it. Ignore rules are text here, not an
//     index.
//   - `.git/` is ALWAYS dropped, because no .gitignore lists it and git itself never shows it.
//
// With no .gitignore (a project before its first commit, or one that never had one) the fallback is
// search_in_files' SKIP_DIRS — the same trees that tool already refuses to walk, so "what the model
// can see" does not depend on which inspection tool it reached for.
//
// Only the ROOT .gitignore is read. Git also honours one per directory; those are not consulted, and
// a project that relies on them will see more than git would.

import ignore from 'ignore';

import type { SandboxClient } from '../core/container/index.js';
import { decodeUtf8Strict } from './decode-utf8-strict.js';
import { hasSkippedSegment } from './has-skipped-segment.js'; // the fallback when there is no .gitignore
import type { WorkspaceEntry } from './workspace-entry.type.js';

/**
 * A predicate answering "is this entry hidden from the listing?".
 *
 * Directories are handed to `ignore` with a trailing slash — a `node_modules/` rule does NOT match
 * the bare string `node_modules`, so without it every ignored directory would still be listed (its
 * contents would not, which reads as an empty directory rather than an absent one).
 */
export async function buildIgnoreFilter(sandbox: SandboxClient): Promise<(entry: WorkspaceEntry) => boolean> {
  const read = await sandbox.readWorkspaceFile('.gitignore');

  let matcher: ReturnType<typeof ignore> | null = null;
  if (read.ok && read.kind === 'file') {
    try {
      matcher = ignore().add(decodeUtf8Strict(read.bytes));
    } catch {
      matcher = null; // a .gitignore that is not UTF-8 text is not a rule set — fall back
    }
  }

  return (entry: WorkspaceEntry): boolean => {
    if (entry.path === '.git' || entry.path.startsWith('.git/')) return true;
    if (matcher === null) return hasSkippedSegment(entry.path);
    return matcher.ignores(entry.isDirectory ? `${entry.path}/` : entry.path);
  };
}
