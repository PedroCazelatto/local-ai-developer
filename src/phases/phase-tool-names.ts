// Per-phase tool allowlists — ONE file holding every phase's array, so "what can this phase call?"
// has exactly one answer and is read without opening a runner. This replaces three scattered filters
// that between them left the planning phases silently ungated: REVIEWER_TOOL_NAMES (reviewer-runner),
// RETRO_PROJECT_TOOL_NAMES (retro-runner), and the orchestrator's `executionTools` subtraction —
// Discovery/Design/Breakdown matched none of them and so received the entire registry.
//
// DATA ONLY. resolve-phase-tools.ts turns these names into the Tool definitions a window sends to
// Ollama, and fails loud on a name no tool answers to — so a typo here cannot silently drop a tool
// from a phase (a missing tool is invisible at runtime: the model simply never sees it).
//
// Each array names EVERY tool its phase gets, registry or not. The six PHASE-SCOPED tools below are
// deliberately absent from the global registry so no other phase can reach them; they appear here
// only in the arrays of the windows whose own `callTool` intercepts them, and resolvePhaseTools
// drops them for a caller that dispatches through the global registry (`registryOnly`).

/**
 * The tools that are NOT in the global registry (registry.ts). Only the window that intercepts one
 * in its own `callTool` can serve it — the shared dispatcher would answer "unknown tool". Callers
 * that route through that dispatcher must therefore exclude these; see resolvePhaseTools.
 */
export const PHASE_SCOPED_TOOL_NAMES: readonly string[] = [
  'submit_verdict',
  'raise_blocker',
  'mark_task_done',
  'submit_retro',
  'read_phase_rule',
  'edit_phase_rule',
];

/**
 * Discovery — the interview. Writes PRODUCT_SPEC.md, commits each validated section, and asks the
 * user through ask_user. Keeps execute_command/run_in_project: the planning phases have always had
 * them, and which commands (if any) deserve blocking is still an open question — see
 * backlog/planning-phase-tool-lists.md. Removing them now would be a guess.
 */
export const DISCOVERY_TOOL_NAMES: readonly string[] = [
  'read_file',
  'write_file',
  'edit_file',
  'list_files',
  'search_in_files',
  'execute_command',
  'run_in_project',
  'list_changes',
  'commit_changes',
  'git_stash',
  'git_inspect',
  'git_branch',
  'git_push',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
  'search_rules',
  'load_rule',
  'spawn_subagent',
  'ask_subagent',
  'dismiss_subagent',
  'ask_user',
];

/** Design — architecture + stories into PRODUCT_SPEC.md. Same surface as Discovery. */
export const DESIGN_TOOL_NAMES: readonly string[] = [
  'read_file',
  'write_file',
  'edit_file',
  'list_files',
  'search_in_files',
  'execute_command',
  'run_in_project',
  'list_changes',
  'commit_changes',
  'git_stash',
  'git_inspect',
  'git_branch',
  'git_push',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
  'search_rules',
  'load_rule',
  'spawn_subagent',
  'ask_subagent',
  'dismiss_subagent',
  'ask_user',
];

/** Breakdown — slices stories into the backlog task tree. Same surface as Discovery. */
export const BREAKDOWN_TOOL_NAMES: readonly string[] = [
  'read_file',
  'write_file',
  'edit_file',
  'list_files',
  'search_in_files',
  'execute_command',
  'run_in_project',
  'list_changes',
  'commit_changes',
  'git_stash',
  'git_inspect',
  'git_branch',
  'git_push',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
  'search_rules',
  'load_rule',
  'spawn_subagent',
  'ask_subagent',
  'dismiss_subagent',
  'ask_user',
];

/**
 * Worker — writes code test-first inside the container. Five deliberate absences:
 * - `commit_changes`: a Worker that commits its own code is its own gatekeeper. The Reviewer commits.
 * - `git_stash`: it could otherwise shelve the very work the Reviewer is about to judge, leaving the
 *   Reviewer a clean tree and no code to review.
 * - `git_push`: it has no commits of its own to publish — it cannot commit.
 * - the sub-agent tools: a spawned execution window has no SubagentManager to back them.
 * - `ask_user`: execution runs unattended, so a question would stall the batch on a keypress nobody
 *   is there to press. The Worker cannot raise a blocker either — only the Reviewer can.
 *
 * It DOES get `git_branch`: one task is one branch, and the Worker is the first actor on a task, so
 * it is what puts the window on `task/<id>` before any code is written. `git_inspect` is read-only.
 */
export const WORKER_TOOL_NAMES: readonly string[] = [
  'read_file',
  'write_file',
  'edit_file',
  'list_files',
  'search_in_files',
  'execute_command',
  'run_in_project',
  'list_changes',
  'git_inspect',
  'git_branch',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
  'search_rules',
  'load_rule',
];

/**
 * Reviewer — read-mostly for code, plus the git tools and its three phase-scoped exits. It gets no
 * write_file/edit_file: it judges the Worker's code and must never be able to quietly patch it and
 * then pass its own edit. execute_command is read-mostly by nature and allowed for inspection; the
 * prompt steers it toward reads. list_changes/commit_changes make it the committing authority for
 * execution work — it is the gate, so it is what stands between written code and the git history.
 */
export const REVIEWER_TOOL_NAMES: readonly string[] = [
  'read_file',
  'search_in_files',
  'list_files',
  'run_in_project',
  'execute_command',
  'search_rules',
  'load_rule',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
  'list_changes',
  'commit_changes',
  'git_stash',
  'git_inspect',
  'git_branch',
  'git_push',
  // Phase-scoped: the normal exit, the halt exit, and closing the task under review.
  'submit_verdict',
  'raise_blocker',
  'mark_task_done',
];

/**
 * Retro — diagnoses a blocker and makes ONE smallest edit. `edit_file` is project-scoped and locks
 * the window to a single file on first success; read_phase_rule/edit_phase_rule are the rules-scoped
 * pair (a rules edit is never auto-committed — a human reviews it). No write_file, no shell: Retro
 * patches one existing file, it does not build anything.
 *
 * It gets all four of the newer git tools even though it still has no commit_changes: diagnosing what
 * went wrong is largely a question about history, which is exactly what git_inspect answers.
 */
export const RETRO_TOOL_NAMES: readonly string[] = [
  'read_file',
  'list_files',
  'search_in_files',
  'edit_file',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
  'git_stash',
  'git_inspect',
  'git_branch',
  'git_push',
  // Phase-scoped: the rules-file pair and the terminal submission.
  'read_phase_rule',
  'edit_phase_rule',
  'submit_retro',
];

/**
 * phase name → its array. The set is closed at the six files under rules/phases/ (docs/rules-loading.md);
 * a phase with no entry here is a bug, and resolvePhaseTools fails loud rather than guessing a default.
 */
export const PHASE_TOOL_NAMES: Readonly<Record<string, readonly string[]>> = {
  discovery: DISCOVERY_TOOL_NAMES,
  design: DESIGN_TOOL_NAMES,
  breakdown: BREAKDOWN_TOOL_NAMES,
  worker: WORKER_TOOL_NAMES,
  reviewer: REVIEWER_TOOL_NAMES,
  retro: RETRO_TOOL_NAMES,
};
