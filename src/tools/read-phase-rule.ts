// read_phase_rule (V3/03) — the Retro window's phase-scoped READ tool for the orchestrator's OWN
// instruction set. It returns the full markdown of a global phase file under rules/phases/ so Retro can
// find the exact text to patch for a SYSTEMIC fix before calling edit_phase_rule. Like the other
// phase-scoped tools it is NOT in the global registry: only the spawned Retro window offers it, and it
// is handled directly by that window (never dispatched through the project-scoped registry).
//
// Scope is enforced by NAME, not by a free path: `phase` must be one of the phase files that actually
// exist on disk (availablePhaseNames), so no `..`/absolute-path traversal can reach the host fs.

import { readFileSync } from 'node:fs';
import type { Tool } from 'ollama';

import { availablePhaseNames } from '../context/available-phase-names.js';
import { phasePromptPath } from '../context/phase-prompt-path.js';
import { errMessage } from '../core/err-message.js'; // an Error's message, or the thrown value stringified

/** The one name the Retro window special-cases to read a global phase instruction file. */
export const READ_PHASE_RULE = 'read_phase_rule';

/** The Ollama tool definition appended to the Retro window's tool list (never the global registry). */
export const readPhaseRuleTool: Tool = {
  type: 'function',
  function: {
    name: READ_PHASE_RULE,
    description:
      'Read the full markdown of a GLOBAL phase instruction file under rules/phases/ (discovery, ' +
      'design, breakdown, worker, reviewer, retro). Use it to locate the exact text to patch for a ' +
      'SYSTEMIC fix before calling edit_phase_rule.',
    parameters: {
      type: 'object',
      required: ['phase'],
      properties: {
        phase: {
          type: 'string',
          description: 'Phase file name without extension, e.g. "discovery", "reviewer".',
        },
      },
    },
  },
};

/** Result of a read_phase_rule call: the markdown, or a structured recoverable error the model reads. */
export type PhaseRuleRead =
  | { readonly ok: true; readonly content: string; readonly resolvedPath: string; readonly phase: string }
  | { readonly ok: false; readonly error: string; readonly hint?: string };

/** Read rules/phases/<phase>.md, rejecting any `phase` that is not an existing phase file (no traversal). */
export function readPhaseRule(phase: unknown): PhaseRuleRead {
  if (typeof phase !== 'string' || phase.trim() === '') {
    return { ok: false, error: "'phase' must be a non-empty string." };
  }
  const normalized = phase.trim().toLowerCase();
  const available = availablePhaseNames();
  if (!available.includes(normalized)) {
    return { ok: false, error: `unknown phase '${normalized}'.`, hint: `Available phases: ${available.join(', ')}` };
  }
  const file = phasePromptPath(normalized);
  try {
    return { ok: true, content: readFileSync(file, 'utf-8'), resolvedPath: file, phase: normalized };
  } catch (err) {
    return { ok: false, error: `could not read rules/phases/${normalized}.md: ${errMessage(err)}` };
  }
}
