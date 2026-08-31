// The `· 12s` tail on a tool's `←` result line — and, for most tools, nothing at all.
//
// Elapsed time is shown ONLY where the wait is the point: a 40 ms read_file does not need a timer and
// a 30-second build does, so the set of timed tools is a closed list rather than a duration threshold
// (a slow read_file is a slow disk, not information). Whole seconds only — a sub-second call reads
// `· 0s`, which is honest ("under a second") in a way that rounding it up to 1s would not be.

/** The tools whose elapsed time is worth a column: the ones you actually wait on. */
const TIMED_TOOLS: ReadonlySet<string> = new Set([
  'execute_command',
  'run_in_project',
  'debate',
  'spawn_subagent',
  'ask_subagent',
]);

/** `· 12s` for a tool worth timing, otherwise nothing. Whole seconds — never a fabricated precision. */
export function elapsedSuffix(tool: string, durationMs: number): string {
  return TIMED_TOOLS.has(tool) ? ` · ${Math.round(Math.max(0, durationMs) / 1000)}s` : '';
}
