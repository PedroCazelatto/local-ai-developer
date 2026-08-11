// Which tool results a live window may replace with a stub — kept as data, the way
// phases/phase-tool-names.ts keeps the per-phase allowlists as data rather than as branching.
//
// THE RULE, in three buckets. Every tool result falls in exactly one:
//
//   1. OBSERVATIONS OF THE PROJECT — evictable. A read, a listing, a search, a git inspection, a
//      command's output all describe a project that is still on disk. The same call answers again, so
//      the stub can honestly point the window back at it and dropping the text costs nothing permanent.
//   2. INSTRUCTIONS THE WINDOW IS WORKING UNDER — never evictable. A standard it loaded, or an inbox
//      item addressed to it, is something the window is meant to be ACTING ON rather than something it
//      looked up. Re-fetching is not even guaranteed to return it — an inbox item the Worker has since
//      resolved is gone from the open list — and the stub has no reassurance to offer here: "the file is
//      unchanged and still editable" says nothing useful about a coding standard.
//   3. ACTIONS THE WINDOW TOOK — never evictable. A write, an edit, a branch, a resolved or posted inbox
//      item: the result is the confirmation that the change landed, it is the one thing the window
//      cannot re-derive by looking, and it is short, so evicting it would reclaim nothing anyway.
//
// WHY THREE BUCKETS AND NOT TWO. The first cut of this rule was "stub what the window LEARNED, never
// what it DID", and search_rules / load_rule are the case that broke it: a loaded standard is plainly
// something the window learned, so a two-bucket rule sweeps it into the evictable set and quietly drops
// the instructions the Worker is supposed to be following. Bucket 2 is what that exception generalizes
// to. It is spelled out here rather than left as a bare absence from the set below, because an
// exception nobody wrote down is exactly how an allowlist rots.
//
// Where the Worker's own fifteen tools land, so the next tool added has a worked example and not just a
// slogan to reason from:
//
//   1. read_file · list_files · search_in_files · git_inspect · list_changes · execute_command ·
//      run_in_project — the last two sit here because what their result CARRIES is a report of project
//      state (a test log, a listing); the audit log, not the window, is the durable record that the
//      call happened.
//   2. search_rules · load_rule · inbox_read
//   3. write_file · edit_file · git_branch · inbox_post · inbox_resolve
//
// DEFAULT-DENY, which matters more than the list itself: a tool this file has never heard of is NOT
// evictable. The registry is global and grows on demand (constitution: add a tool when the model needs
// one), so a tool added elsewhere must not become silently stubbable by appearing somewhere else. It
// becomes evictable only when someone adds it here and can say which bucket it is in and why. A tool
// whose bucket is genuinely unclear stays out: keeping a result too long costs some window, and dropping
// one the model needed costs the task.
//
// Three of the never-evictable tools — commit_changes, mark_task_done, raise_blocker — are not on the
// Worker's own allowlist at all and so cannot reach this window. They are named in this comment anyway,
// for the reason worker-runner.ts's WORKER_REFUSALS gives for refusing them a second time: the registry
// is global and a model that recovers a tool call from bare JSON can name a tool it was never offered.
// Under default-deny they are already safe; the naming is documentation, not a second guard.

/**
 * Bucket 1 — tools whose result is an observation of the project the window can make again. Everything
 * absent from this set, named or not, known or not, keeps its result verbatim forever.
 */
const EVICTABLE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'read_file',
  'search_in_files',
  'list_files',
  'git_inspect',
  'list_changes',
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
