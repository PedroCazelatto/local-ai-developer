// resolvePhaseTools — turn a phase's name array (phase-tool-names.ts) into the Tool definitions its
// window sends to Ollama. This is the one place the per-phase arrays become real tool definitions,
// so gating is applied identically to the active interactive phase and to every spawned window.
//
// FAIL LOUD, NEVER SILENT: an unknown phase, or a name no tool answers to, throws PhaseToolsError
// (phase-tools-error.ts) naming the offender. A dropped tool is invisible at runtime — the model
// simply never sees it and works around the gap — so a typo in an array must not degrade into a
// quietly smaller tool set.

import type { Tool } from 'ollama';

import { editPhaseRuleTool } from '../tools/edit-phase-rule.js';
import { markTaskDoneTool } from '../tools/mark-task-done.js';
import { raiseBlockerTool } from '../tools/raise-blocker.js';
import { readPhaseRuleTool } from '../tools/read-phase-rule.js';
import { submitRetroTool } from '../tools/submit-retro.js';
import { submitVerdictTool } from '../tools/submit-verdict.js';
import { toolDefinitions } from '../tools/tool-definitions.js';
import { PhaseToolsError } from './phase-tools-error.js';
import { PHASE_SCOPED_TOOL_NAMES, PHASE_TOOL_NAMES } from './phase-tool-names.js';

// The tools kept OUT of the global registry so no other phase can reach them (registry.ts). Already
// `Tool` definitions rather than ToolModules — the windows that own them wire them in directly.
const PHASE_SCOPED_TOOLS: readonly Tool[] = [
  submitVerdictTool,
  raiseBlockerTool,
  markTaskDoneTool,
  submitRetroTool,
  readPhaseRuleTool,
  editPhaseRuleTool,
];

export interface ResolvePhaseToolsOptions {
  /**
   * Drop the phase-scoped tools, keeping only what the GLOBAL registry can serve. Set this when the
   * caller routes tool calls through the shared dispatcher (dispatch.ts → getTool), which knows the
   * registry and nothing else: offering `submit_verdict` to a window that dispatches that way would
   * hand the model a tool whose only possible answer is "unknown tool". The spawned Worker/Reviewer/
   * Retro windows intercept their own phase-scoped tools in `callTool`, so they leave this unset.
   */
  readonly registryOnly?: boolean;
}

/**
 * The Tool definitions phase `phaseName` may call, in the order its array lists them. Reads the
 * registry fresh on every call (it is static and 18 entries — cheap) so this never holds a stale set.
 * Throws PhaseToolsError when the phase has no array, or when an array names a tool that does not
 * exist. With `registryOnly`, the phase-scoped tools are omitted — see ResolvePhaseToolsOptions.
 */
export function resolvePhaseTools(phaseName: string, options: ResolvePhaseToolsOptions = {}): Tool[] {
  const normalized = phaseName.trim().toLowerCase();
  const names = PHASE_TOOL_NAMES[normalized];
  if (names === undefined) {
    throw new PhaseToolsError(
      `No tool list for phase '${normalized}'. Add its array to src/phases/phase-tool-names.ts. ` +
        `Known phases: ${Object.keys(PHASE_TOOL_NAMES).join(', ')}.`,
    );
  }

  // name → definition across BOTH sources: the global registry, and the phase-scoped tools that are
  // deliberately absent from it.
  const byName = new Map<string, Tool>();
  for (const tool of [...toolDefinitions(), ...PHASE_SCOPED_TOOLS]) {
    const name = tool.function.name;
    if (name !== undefined) byName.set(name, tool);
  }

  const resolved: Tool[] = [];
  for (const name of names) {
    if (options.registryOnly === true && PHASE_SCOPED_TOOL_NAMES.includes(name)) continue;
    const tool = byName.get(name);
    if (tool === undefined) {
      throw new PhaseToolsError(
        `Phase '${normalized}' lists unknown tool '${name}' in src/phases/phase-tool-names.ts. ` +
          `Known tools: ${[...byName.keys()].sort().join(', ')}.`,
      );
    }
    resolved.push(tool);
  }
  return resolved;
}
