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
export { truncateHeadTail, DEFAULT_OUTPUT_LIMIT } from './truncate.js';
