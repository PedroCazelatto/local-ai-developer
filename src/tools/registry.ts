// Tool registry (V1/02). A STATIC list of every ToolModule (explicit imports the build can check —
// no runtime fs scan). Duplicate names are rejected loudly at load. `toolDefinitions()` builds the
// Ollama `tools` array sent on EVERY chat/stream call for EVERY phase — there is no per-phase tool
// whitelist (the phase markdown steers which tools to use; the orchestrator never gates access).

import type { Tool } from '../core/llm/index.js';
import { readFileTool } from './read-file.js';
import type { ToolModule } from './types.js';

// The static module list. Each new tool (V1/03 file tools, V1/04 execute_command, V1/05
// run_in_project) appends its module here and is picked up everywhere automatically.
const TOOL_MODULES: readonly ToolModule[] = [readFileTool];

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
