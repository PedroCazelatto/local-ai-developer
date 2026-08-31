// context/ — system-prompt and context builders that assemble the messages array sent to Ollama
// for a given phase. Foundation task 06 adds the minimal system-prompt builder; V1/01 adds the
// phase-instruction loader that seeds each phase's system message from rules/phases/<phase>.md.
export { buildSystemPrompt } from './system-prompt.js';
// The generated "# Your Tools" block: the phase's real tool array rendered as a closed name list,
// so no phase file has to hand-maintain an inventory that can drift from the registry.
export { buildToolSection } from './build-tool-section.js';
// One function per file (constitution): the phase-prompt trio and the rules/phases/ vocabulary they
// share — PHASES_DIR and PhasePromptError — which is all phase-prompt.ts still holds.
export { loadPhasePrompt } from './load-phase-prompt.js';
export { availablePhaseNames } from './available-phase-names.js';
export { phasePromptPath } from './phase-prompt-path.js';
export { PhasePromptError, PHASES_DIR } from './phase-prompt.js';
// V4/01: standards catalog — frontmatter-only {name, description} list for search_rules (V4/02).
export { loadCatalog } from './load-catalog.js';
export type { StandardEntry } from './load-catalog.js';
export { StandardsCatalogError, STANDARDS_DIR } from './standards-catalog.js';
// V4/02: frontmatter-stripped body of one standard by name — the read behind the load_rule tool.
export { loadStandardBody } from './load-standard-body.js';
export type { StandardBody } from './load-standard-body.js';
