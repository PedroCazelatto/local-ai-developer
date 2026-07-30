// context/ — system-prompt and context builders that assemble the messages array sent to Ollama
// for a given phase. Foundation task 06 adds the minimal system-prompt builder; V1/01 adds the
// phase-instruction loader that seeds each phase's system message from rules/phases/<phase>.md.
export { buildSystemPrompt } from './system-prompt.js';
// The generated "# Your Tools" block: the phase's real tool array rendered as a closed name list,
// so no phase file has to hand-maintain an inventory that can drift from the registry.
export { buildToolSection } from './build-tool-section.js';
export {
  loadPhasePrompt,
  availablePhaseNames,
  phasePromptPath,
  PhasePromptError,
  PHASES_DIR,
} from './phase-prompt.js';
// V4/01: standards catalog — frontmatter-only {name, description} list for search_rules (V4/02).
export { loadCatalog, StandardsCatalogError, STANDARDS_DIR } from './standards-catalog.js';
export type { StandardEntry } from './standards-catalog.type.js';
// V4/02: frontmatter-stripped body of one standard by name — the read behind the load_rule tool.
export { loadStandardBody } from './load-standard-body.js';
export type { StandardBody } from './load-standard-body.type.js';
