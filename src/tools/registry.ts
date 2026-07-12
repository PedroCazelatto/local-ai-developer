// Tool registry (V1/02). A STATIC list of every ToolModule (explicit imports the build can check —
// no runtime fs scan). Duplicate names are rejected loudly at load. `toolDefinitions()` builds the
// Ollama `tools` array sent on EVERY chat/stream call for EVERY phase — there is no per-phase tool
// whitelist (the phase markdown steers which tools to use; the orchestrator never gates access).

import type { Tool } from '../core/llm/index.js';
import { askSubagentTool } from './ask-subagent.js';
import { dismissSubagentTool } from './dismiss-subagent.js';
import { editFileTool } from './edit-file.js';
import { executeCommandTool } from './execute-command.js';
import { inboxPostTool } from './inbox-post.js';
import { inboxReadTool } from './inbox-read.js';
import { inboxResolveTool } from './inbox-resolve.js';
import { listFilesTool } from './list-files.js';
import { loadRuleTool } from './load-rule.js';
import { readFileTool } from './read-file.js';
import { runInProjectTool } from './run-in-project.js';
import { searchInFilesTool } from './search-in-files.js';
import { searchRulesTool } from './search-rules.js';
import { spawnSubagentTool } from './spawn-subagent.js';
import type { ToolModule } from './types.js';
import { writeFileTool } from './write-file.js';

// The static module list — every tool the model can call. New tools append here and are picked up
// everywhere automatically.
const TOOL_MODULES: readonly ToolModule[] = [
  listFilesTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  searchInFilesTool,
  executeCommandTool,
  runInProjectTool,
  // Cross-phase inbox (V3/04) — the AGENT_NOTES.md replacement; global (every phase reads/posts).
  inboxReadTool,
  inboxPostTool,
  inboxResolveTool,
  // On-demand standards retrieval (V4/02) — global; every phase (and the Worker/Reviewer windows) can
  // resolve an intent to a standard name and load that one body without the catalog entering context.
  searchRulesTool,
  loadRuleTool,
  // Sub-agents (V5/01) — spawn/ask/dismiss a fresh-context worker. Registered globally so the
  // interactive phases advertise them; the orchestrator backs them with the SubagentManager and does
  // NOT pass them to the spawned execution windows (Worker/Reviewer/Retro), which have no manager.
  spawnSubagentTool,
  askSubagentTool,
  dismissSubagentTool,
];

/** name → module, built once with a duplicate-name guard (a dup is a build-time mistake, fail loud). */
const REGISTRY: ReadonlyMap<string, ToolModule> = buildRegistry(TOOL_MODULES);

function buildRegistry(modules: readonly ToolModule[]): Map<string, ToolModule> {
  const map = new Map<string, ToolModule>();
  for (const module of modules) {
    if (map.has(module.name)) {
      throw new Error(`Duplicate tool name '${module.name}' in the tool registry.`);
    }
    map.set(module.name, module);
  }
  return map;
}

/** Look up a tool by name; undefined if unknown (the dispatcher turns that into a recoverable error). */
export function getTool(name: string): ToolModule | undefined {
  return REGISTRY.get(name);
}

/** Every registered tool name (used for the unknown-tool error's `available` list). */
export function toolNames(): string[] {
  return [...REGISTRY.keys()];
}

/**
 * Build the Ollama `tools` array from the registry: one function entry per module. Sent on every
 * call for every phase. The `parameters` schema is structurally the JSON-schema Ollama expects.
 */
export function toolDefinitions(): Tool[] {
  return [...REGISTRY.values()].map((module) => ({
    type: 'function',
    function: {
      name: module.name,
      description: module.description,
      parameters: {
        type: module.parameters.type,
        properties: module.parameters.properties,
        // Copy the readonly required list into a fresh mutable array for Ollama's Tool type.
        ...(module.parameters.required ? { required: [...module.parameters.required] } : {}),
      },
    },
  }));
}
