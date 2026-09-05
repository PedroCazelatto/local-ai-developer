// listSearchCandidates — which files in the project contain the pattern, decided INSIDE the sandbox
// by one `grep -l`. This is the first of search_in_files' two steps, and the reason the search is
// affordable at all: the container answers "which files" in a single round trip, and only those files
// are then pulled across to be rendered.
//
// `-F` fixed strings, never a regex — the tool is literal-substring by design (see the tool header).
// `-I` skips binaries, `-l` prints paths only, and --exclude-dir prunes the vendored trees before
// grep ever opens them; after one `npm i`, node_modules holds more matches than any cap allows.
//
// LC_ALL=C.UTF-8 pins the collation `-i` folds under, so the candidate set does not depend on the
// container's locale. The authoritative match is still made host-side by findMatchingLines — this
// step only decides which files are worth transferring, so a locale edge case costs a wasted read
// rather than a wrong answer.

import type { SandboxClient } from '../core/container/sandbox.js';
// Wraps a model-supplied value as one shell argument, so a pattern with a space or a quote survives.
import { quoteShellArgument } from './quote-shell-argument.js';
// The vendored/generated trees search_in_files has always refused to walk.
import { SKIP_DIRS } from './skip-dirs.js';

/** grep's "no lines selected" exit code — not an error, just an empty answer. */
const GREP_NO_MATCH = 1;

export type SearchCandidates =
  | { readonly ok: true; readonly paths: readonly string[] }
  | { readonly ok: false; readonly message: string };

/**
 * Project-root-relative paths of every file containing `pattern`, sorted. `glob` filters on the file
 * NAME (grep's --include, the same `*`/`?` semantics the old host-side glob had); null searches all.
 */
export async function listSearchCandidates(
  sandbox: SandboxClient,
  pattern: string,
  glob: string | null,
  caseSensitive: boolean,
): Promise<SearchCandidates> {
  const excludes = [...SKIP_DIRS].map((dir) => `--exclude-dir=${quoteShellArgument(dir)}`).join(' ');
  const include = glob === null ? '' : ` --include=${quoteShellArgument(glob)}`;
  const fold = caseSensitive ? '' : ' -i';
  const command =
    `LC_ALL=C.UTF-8 grep -rlIF${fold} ${excludes}${include} -e ${quoteShellArgument(pattern)} .`;

  const result = await sandbox.exec(command);
  if (result.exitCode === GREP_NO_MATCH && result.stdout.trim() === '') {
    return { ok: true, paths: [] };
  }
  if (result.exitCode !== 0 && result.stdout.trim() === '') {
    return { ok: false, message: result.stderr.trim() };
  }

  const paths = result.stdout
    .split('\n')
    .map((line) => line.replace(/^\.\//, '').trim())
    .filter((line) => line !== '');
  paths.sort();
  return { ok: true, paths };
}
