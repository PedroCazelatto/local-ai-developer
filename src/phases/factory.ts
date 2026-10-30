// PhaseFactory — discovers the phase instruction files under rules/phases/ and builds a Phase
// from one (ports agents/factory.py's AgentFactory). The markdown files are the single source of
// each phase's behavior; this just reads them, delegating the actual read to loadPhasePrompt
// (V1/01) so instructions are re-read FRESH on every activation and a missing file fails loud
// with a typed error naming the expected path.

import { availablePhaseNames } from '../context/available-phase-names.js';
import { loadPhasePrompt } from '../context/load-phase-prompt.js';
import { PHASE_TOOL_NAMES } from './phase-tool-names.js';
import type { Phase } from './phase.js';

export class PhaseFactory {
  /** Sorted basenames of rules/phases/*.md (ports available_roles). */
  static availablePhases(): string[] {
    return availablePhaseNames();
  }

  /**
   * Load a phase by name. Normalizes to lowercase and reads its instruction markdown fresh via
   * loadPhasePrompt — which throws a typed PhasePromptError naming `rules/phases/<phase>.md` if the
   * file is missing (the REPL turns this into a recoverable /swap line; boot turns it into a fatal
   * error). Called on every activation (constructor + /swap), so edits to a phase file are picked
   * up on the next swap without restarting.
   *
   * Also attaches the phase's tool allowlist from phase-tool-names.ts. A phase file with no array
   * throws here — at ACTIVATION, the same seam where a missing markdown file surfaces, so /swap
   * renders it as a recoverable line instead of a turn failing mid-stream.
   */
  static get(name: string): Phase {
    const normalized = name.trim().toLowerCase();
    const instructions = loadPhasePrompt(normalized);
    const tools = PHASE_TOOL_NAMES[normalized];
    if (tools === undefined) {
      throw new Error(
        `Phase '${normalized}' has no tool list. Add its array to src/phases/phase-tool-names.ts. ` +
          `Phases with one: ${Object.keys(PHASE_TOOL_NAMES).join(', ')}.`,
      );
    }
    return { name: normalized, instructions, tools };
  }
}
