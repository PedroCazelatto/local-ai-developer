// submit_retro (V3/03) — the Retro window's phase-scoped "I'm done" tool. Like submit_verdict /
// raise_blocker it is deliberately NOT in the global registry (registry.ts): only the spawned Retro
// window offers it, captures the call directly, and ends its turn. The model calls it EXACTLY ONCE,
// AFTER making its single file edit, with { scope, rootCause }.
//
// The scope the model submits is ADVISORY: the orchestrator decides commit-vs-review by the RESOLVED
// path of the file actually edited (rules/phases/ ⇒ systemic/uncommitted+warn; project ⇒ task-specific/
// commit). Capturing it anyway forces the model to reason about the classification and yields a
// reliable one-sentence rootCause via the same tool-call recovery pipeline every other tool rides.

import type { Tool } from '../core/llm/index.js';
import type { RetroScope } from '../core/session/retro-scope.type.js';
import { RETRO_SCOPES } from '../core/session/retro-scopes.js';
import type { RetroSubmission } from '../core/session/retro-submission.type.js';
import { describeValue } from './describe-value.js'; // a string quoted, anything else stringified

/** The one name the Retro window special-cases to capture its diagnosis and end the turn. */
export const SUBMIT_RETRO = 'submit_retro';

/** The Ollama tool definition appended to the Retro window's tool list (never the global registry). */
export const submitRetroTool: Tool = {
  type: 'function',
  function: {
    name: SUBMIT_RETRO,
    description:
      'Record your FINAL Retro diagnosis — exactly once, AFTER you have made your single file edit. ' +
      'scope: "systemic" if you patched a global phase file under rules/phases/ (edit_phase_rule), ' +
      '"task-specific" if you patched the project doc (edit_file). rootCause: ONE sentence naming the ' +
      'upstream gap that let the ambiguous task reach execution. Calling this ends the Retro — do not ' +
      'call any tool afterward.',
    parameters: {
      type: 'object',
      required: ['scope', 'rootCause'],
      properties: {
        scope: {
          type: 'string',
          enum: ['systemic', 'task-specific'],
          description: '"systemic" = a global phase file was patched; "task-specific" = the project doc was patched.',
        },
        rootCause: {
          type: 'string',
          description: 'One sentence: the upstream gap that let an ambiguous task reach execution.',
        },
      },
    },
  },
};

/** Result of parsing a submit_retro payload: a valid submission, or a message the model can fix from. */
export type RetroSubmissionParse =
  | { readonly ok: true; readonly submission: RetroSubmission }
  | { readonly ok: false; readonly error: string };

/** Validate a submit_retro payload into a RetroSubmission (valid scope + a non-empty one-sentence cause). */
export function parseRetroSubmission(args: Record<string, unknown>): RetroSubmissionParse {
  const scope = args['scope'];
  if (typeof scope !== 'string' || !(RETRO_SCOPES as readonly string[]).includes(scope)) {
    return { ok: false, error: `"scope" must be one of ${RETRO_SCOPES.join(' | ')} (got ${describeValue(scope)}).` };
  }
  const rootCause = args['rootCause'];
  if (typeof rootCause !== 'string' || rootCause.trim() === '') {
    return { ok: false, error: '"rootCause" must be a non-empty, one-sentence root-cause diagnosis.' };
  }
  return { ok: true, submission: { scope: scope as RetroScope, rootCause: rootCause.trim() } };
}
