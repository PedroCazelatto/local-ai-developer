// tools/ — model-callable actions + the registry/dispatch spine (V1/02). Each tool is a ToolModule
// dropped into this dir and listed in registry.ts; which phases may call it is set by the arrays in
// phases/phase-tool-names.ts. read_file is the first (V1/03 adds the rest of the file tools,
// V1/04/05 the shell/container tools).
export type { ToolModule } from './tool-module.type.js';
export type { ToolContext } from './tool-context.type.js';
export type { ToolResult } from './tool-result.type.js';
export type { StructuredToolResult } from './structured-tool-result.type.js';
export type { JSONSchema } from './json-schema.type.js';
export type { JSONSchemaProperty } from './json-schema-property.type.js';
export type { JsonObject } from './json-object.type.js';
export type { JsonValue } from './json-value.type.js';
export { toolError } from './tool-error.js';
export { createToolContext } from './create-tool-context.js';
export { resolveInProject } from './resolve-in-project.js';
export { WORKSPACE_PATH } from './workspace-path.js';
export { getTool, toolNames, toolDefinitions } from './registry.js';
export { readFileTool } from './read-file.js';
export { listFilesTool } from './list-files.js';
export { writeFileTool } from './write-file.js';
export { editFileTool } from './edit-file.js';
export { searchInFilesTool } from './search-in-files.js';
export { executeCommandTool } from './execute-command.js';
export { runInProjectTool } from './run-in-project.js';
// Project git — global registry tools; commit_changes is withheld from the Worker window (only the
// Reviewer commits execution work) and its message is written by a throwaway one-shot context.
export { listChangesTool, LIST_CHANGES } from './list-changes.js';
export { commitChangesTool, COMMIT_CHANGES } from './commit-changes.js';
export { composeCommitMessage } from './compose-commit-message.js';
export type { ComposeCommitMessageInput } from './compose-commit-message.type.js';
// The rest of git — global registry tools, gated per phase by phase-tool-names.ts. git_stash and
// git_push are additionally refused inside the Worker window (see worker-runner).
export { gitStashTool, GIT_STASH } from './git-stash.js';
export { gitInspectTool, GIT_INSPECT } from './git-inspect.js';
export { gitBranchTool, GIT_BRANCH } from './git-branch.js';
export { gitPushTool, GIT_PUSH } from './git-push.js';
export { inboxReadTool } from './inbox-read.js';
export { inboxPostTool } from './inbox-post.js';
export { inboxResolveTool } from './inbox-resolve.js';
// On-demand standards retrieval (V4/02) — global registry tools.
export { searchRulesTool } from './search-rules.js';
export { loadRuleTool } from './load-rule.js';
// Sub-agents (V5/01) — global registry tools; the orchestrator backs them with the SubagentManager.
export { spawnSubagentTool, SPAWN_SUBAGENT } from './spawn-subagent.js';
export { askSubagentTool, ASK_SUBAGENT } from './ask-subagent.js';
export { dismissSubagentTool, DISMISS_SUBAGENT } from './dismiss-subagent.js';
// Interactive questioning (V6/01) — a global registry tool, but withheld from the spawned execution
// windows by the orchestrator (they run unattended; a question would stall the batch).
export { askUserTool, ASK_USER } from './ask-user.js';
export { truncateHeadTail, DEFAULT_OUTPUT_LIMIT } from './truncate.js';
// The compact +/- diff the write tools hand to the scrollback, and the caps above which it collapses
// to counts alone.
export { buildFileDiff, DIFF_MAX_CHANGED_LINES, DIFF_MAX_CHARS } from './build-file-diff.js';
// Phase-scoped (Reviewer-only, V2/01) — deliberately NOT added to the registry in registry.ts.
export { submitVerdictTool, parseVerdict, SUBMIT_VERDICT } from './submit-verdict.js';
export type { VerdictParse } from './submit-verdict.js';
// Phase-scoped (Retro-only, V3/03) — also NOT in the registry: only the spawned Retro window offers them.
export { submitRetroTool, parseRetroSubmission, SUBMIT_RETRO } from './submit-retro.js';
export type { RetroSubmissionParse } from './submit-retro.js';
// Phase-scoped (Reviewer-only) — NOT in the registry: the Reviewer flips the task under review to
// `done` without ever getting general write access, then commits the backlog file it changed.
export { markTaskDoneTool, MARK_TASK_DONE } from './mark-task-done.js';
export { readPhaseRuleTool, readPhaseRule, READ_PHASE_RULE } from './read-phase-rule.js';
export type { PhaseRuleRead } from './read-phase-rule.js';
export { editPhaseRuleTool, applyPhaseRuleEdit, EDIT_PHASE_RULE } from './edit-phase-rule.js';
export type { PhaseRuleEdit } from './edit-phase-rule.js';
