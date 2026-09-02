// The Ollama `tools` array, built from the registry. This is the FULL set; no phase is handed it
// as-is -- phases/phase-tool-names.ts holds one allowlist per phase and phases/resolve-phase-tools.ts
// narrows this down to it.
//
// `toolRegistry` is read inside the function body, for the reason get-tool.ts states in full: this
// directory sits in an import cycle with core/session, and a module-evaluation-time read of a value
// reached through one throws before it is initialised.

import type { Tool } from '../core/llm/index.js';
import { toolRegistry } from './registry.js';

/**
 * Build the Ollama `tools` array from the registry: one function entry per module. Sent on every
 * call for every phase. The `parameters` schema is structurally the JSON-schema Ollama expects.
 */
export function toolDefinitions(): Tool[] {
  return [...toolRegistry.values()].map((module) => ({
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
