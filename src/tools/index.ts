// tools/ — model-callable actions + the registry/dispatch spine (V1/02). Each tool is a ToolModule
// dropped into this dir and listed in registry.ts; which phases may call it is set by the arrays in
// phases/phase-tool-names.ts. read_file is the first (V1/03 adds the rest of the file tools,
// V1/04/05 the shell/container tools).
export type {
  ToolModule,
  ToolContext,
  ToolResult,
  StructuredToolResult,
  JSONSchema,
  JSONSchemaProperty,
  JsonObject,
  JsonValue,
} from './types.js';
export { toolError } from './types.js';
export { createToolContext, resolveInProject, WORKSPACE_PATH } from './context.js';
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
