// SKIP_DIRS — the trees no inspection tool walks: version control, virtualenvs, dependencies, build
// output. Not an optimization. After a single `npm i`, node_modules alone holds more matches than any
// cap allows, so an unfiltered search spends its whole match budget inside vendored code before ever
// reaching src/.
//
// ONE definition, two consumers, and they must not disagree: search_in_files passes it to grep as
// --exclude-dir, and list_files falls back to it when a project has no .gitignore to read. "What the
// model can see" would otherwise depend on which inspection tool it happened to reach for.
//
// This file holds a constant rather than a function — it was extracted from walk-project-files.ts,
// whose host-side walker the move into the sandbox retired: `grep -rl` inside the container does that
// walk now, and a host walker left behind would be a second, reachable route to the host tree.

export const SKIP_DIRS: ReadonlySet<string> = new Set([
  '.git',
  '__pycache__',
  'node_modules',
  '.venv',
  'venv',
  'dist',
  'build',
]);
