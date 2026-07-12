// tools/ — model-callable actions + the registry/dispatch spine (V1/02). Each tool is a ToolModule
// dropped into this dir and listed in registry.ts; every phase gets every tool. read_file is the
// first (V1/03 adds the rest of the file tools, V1/04/05 the shell/container tools).
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
export { truncateHeadTail, DEFAULT_OUTPUT_LIMIT } from './truncate.js';
// Phase-scoped (Reviewer-only, V2/01) — deliberately NOT added to the registry in registry.ts.
export { submitVerdictTool, parseVerdict, SUBMIT_VERDICT } from './submit-verdict.js';
export type { VerdictParse } from './submit-verdict.js';
// Phase-scoped (Retro-only, V3/03) — also NOT in the registry: only the spawned Retro window offers them.
export { submitRetroTool, parseRetroSubmission, SUBMIT_RETRO } from './submit-retro.js';
export type { RetroSubmissionParse } from './submit-retro.js';
export { readPhaseRuleTool, readPhaseRule, READ_PHASE_RULE } from './read-phase-rule.js';
export type { PhaseRuleRead } from './read-phase-rule.js';
export { editPhaseRuleTool, applyPhaseRuleEdit, EDIT_PHASE_RULE } from './edit-phase-rule.js';
export type { PhaseRuleEdit } from './edit-phase-rule.js';
