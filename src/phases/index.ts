// phases/ — the Phase abstraction and factory (replaces the Python "persona"/"role" concept
// entirely; no legacy naming). Foundation task 06.
export type { Phase } from './phase.js';
export { PhaseFactory } from './factory.js';
// Per-phase tool gating: the arrays (one file, all six) + the resolver that turns one into the Tool
// definitions a window sends to Ollama.
export {
  PHASE_TOOL_NAMES,
  PHASE_SCOPED_TOOL_NAMES,
  DISCOVERY_TOOL_NAMES,
  DESIGN_TOOL_NAMES,
  BREAKDOWN_TOOL_NAMES,
  WORKER_TOOL_NAMES,
  REVIEWER_TOOL_NAMES,
  RETRO_TOOL_NAMES,
} from './phase-tool-names.js';
export { resolvePhaseTools } from './resolve-phase-tools.js';
export type { ResolvePhaseToolsOptions } from './resolve-phase-tools.js';
export { PhaseToolsError } from './phase-tools-error.js';
