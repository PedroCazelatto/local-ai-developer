// raise_blocker (V3/02) — the Reviewer's phase-scoped loop-halt tool. Like submit_verdict, it is
// deliberately NOT in the global registry (registry.ts): only the spawned Reviewer window offers it,
// captures the call directly, persists the blocker, and ends its turn. Because it never enters the
// registry, the Worker (which is sent toolDefinitions() — the whole registry) literally cannot see or
// call it; a stray call from any other phase falls through dispatch as "unknown tool".
//
// CLAUDE.md "Loop control": only the Reviewer may raise a blocker (a local model is more often
// confidently-wrong than self-aware, so a self-reported Worker "I'm confused" isn't trustworthy). The
// Reviewer raises it IMMEDIATELY on genuine ambiguity/under-specification/self-contradiction — NOT for
// ordinary review failures, which go back as fix feedback in the verdict.

import type { Tool } from '../core/llm/index.js';
import type { BlockerRequest } from './raise-blocker.type.js';

/** The one name the Reviewer window special-cases to capture a raised blocker. */
export const RAISE_BLOCKER = 'raise_blocker';

/** The phase allowed to raise a blocker — the sole gatekeeper of the execution loop (CLAUDE.md). */
const REVIEWER_PHASE = 'reviewer';

/** The Ollama tool definition appended to the Reviewer's tool list (never the global registry). */
export const raiseBlockerTool: Tool = {
  type: 'function',
  function: {
    name: RAISE_BLOCKER,
    description:
      'Raise a BLOCKER and halt the loop when the TASK ITSELF is the problem — it is ambiguous, ' +
      'under-specified, self-contradictory, or conflicts with the architecture, so no amount of ' +
      'Worker fixing can resolve it. Call this IMMEDIATELY instead of submit_verdict; do not spend ' +
      'review rounds first, and do not call any other tool afterward. The question is surfaced to the ' +
      'user, who answers it before the task is retried. This is NOT for ordinary review failures — ' +
      'when the code is merely wrong or incomplete, submit a "fail" verdict with concrete fix feedback.',
    parameters: {
      type: 'object',
      required: ['question'],
      properties: {
        question: {
          type: 'string',
          description:
            'The precise question for the user — what is ambiguous/contradictory and what you need ' +
            'decided to judge this task. Concrete, answerable, and specific to this task.',
        },
      },
    },
  },
};

/**
 * Gate a raise_blocker call: enforce Reviewer-only + a non-empty question, returning the SAME
 * structured recoverable shape the model reads whether accepted or rejected. Pure — it does not
 * persist; the Reviewer window calls this, then (on ok) writes the durable `raised` row and ends its
 * turn. The `not_authorized` branch is belt-and-suspenders (the tool is never wired to a non-Reviewer
 * window), so `phase` is passed in explicitly rather than assumed.
 */
export function validateBlockerRequest(phase: string, rawQuestion: unknown): BlockerRequest {
  if (phase !== REVIEWER_PHASE) {
    return { ok: false, error: 'not_authorized', message: 'raise_blocker is Reviewer-only' };
  }
  if (typeof rawQuestion !== 'string' || rawQuestion.trim() === '') {
    return { ok: false, error: 'empty_question', message: 'question must be a non-empty string' };
  }
  return { ok: true, question: rawQuestion.trim() };
}
