// Which tool results a live window may replace with a stub — kept as data, the way
// phases/phase-tool-names.ts keeps the per-phase allowlists as data rather than as branching.
//
// THE RULE: stub what the window LEARNED, never what the window DID.
//
// A read, a listing, a search, a git inspection, a command's output are OBSERVATIONS of a codebase that
// is still on disk. Dropping their text costs the window nothing it cannot get back by looking again,
// which is what makes them safe to evict. A write, an edit, a branch, a commit, a posted inbox item are
// the RECORD THAT SOMETHING HAPPENED — there is nowhere else to read that record from, and they are
// short, so evicting them would reclaim nothing while destroying the only trace. That asymmetry is the
// whole rule, and it is written here so the list below cannot drift away from a reason.
//
// DEFAULT-DENY, which matters more than the list itself: a tool this file has never heard of is NOT
// evictable. The registry is global and grows on demand (constitution: add a tool when the model needs
// one), so a tool added elsewhere must not become silently stubbable by appearing somewhere else. It
// becomes evictable only when someone adds it here and argues that its result is an observation.
//
// Three of the never-evictable tools — commit_changes, mark_task_done, raise_blocker — are not on the
// Worker's own allowlist at all and so cannot reach this window. They are named in this comment anyway,
// for the reason worker-runner.ts's WORKER_REFUSALS gives for refusing them a second time: the registry
// is global and a model that recovers a tool call from bare JSON can name a tool it was never offered.
// Under default-deny they are already safe; the naming is documentation, not a second guard.

/**
 * Tools whose result is an observation the window can make again. Everything absent from this set —
 * named or not, known or not — keeps its result verbatim forever.
 */
const EVICTABLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'read_file',
  'search_in_files',
  'list_files',
  'git_inspect',
  'execute_command',
  'run_in_project',
]);

/**
 * Whether a `tool` message produced by `toolName` may have its content replaced by a stub.
 *
 * `undefined` is a real case, not a guard against one: a `tool` message carries `tool_name` only when
 * the runner set it, and a result whose tool is unknown is exactly the case default-deny exists for.
 */
export function isEvictableTool(toolName: string | undefined): boolean {
  return toolName !== undefined && EVICTABLE_TOOL_NAMES.has(toolName);
}
