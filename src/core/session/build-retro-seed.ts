// The seed user message for a Retro window: the inputs, the classification rules, the tools, and the
// ONE-FILE contract stated as a contract rather than a suggestion.
//
// The stashed failed attempt (V3/05) rides along only when present, and is labelled EVIDENCE, NOT
// CORRECT CODE -- it is there so Retro can see HOW the ambiguity misled implementation. A fresh Worker
// redoes the task from scratch and never reuses it.

import { EDIT_PHASE_RULE } from '../../tools/edit-phase-rule.js';
import { READ_PHASE_RULE } from '../../tools/read-phase-rule.js';
import { SUBMIT_RETRO } from '../../tools/submit-retro.js';
import type { RetroInput } from './retro-input.type.js';

/** Assemble the seed user message: the inputs + the classification rules + the tool + one-file contract. */
export function buildRetroSeed(input: RetroInput): string {
  const { task, misunderstanding, answer, failedAttempt } = input;
  // The stashed failed attempt (V3/05) is advisory evidence of HOW the ambiguity misled implementation —
  // included only when present; never presented as correct (the Worker redoes the task from scratch).
  const attemptSection =
    failedAttempt !== undefined && failedAttempt.trim() !== ''
      ? `\n## The failed Worker attempt that triggered the blocker (stashed diff — evidence, NOT correct code)
Use this to see HOW the ambiguous task misled implementation; do not treat it as a solution to preserve.
\`\`\`diff
${failedAttempt.trim()}
\`\`\`
`
      : '';
  return `You are the Retro phase. A Reviewer raised a blocker on ONE task, the user answered it, and your job is to make the SMALLEST edit to ONE file so this class of misunderstanding cannot recur. Diagnose the ROOT cause — what upstream gap let an ambiguous task reach execution — classify it, patch exactly one file, then call ${SUBMIT_RETRO}.

## Task that blocked: ${task.title}
(backlog id: ${task.id})

${task.body}

## The misunderstanding (the Reviewer's blocker question)
${misunderstanding}

## The user's resolving answer
${answer}
${attemptSection}
How to patch (choose ONE file — editing two means you mis-classified):
- SYSTEMIC gap — a question the protocol should ALWAYS ask, or a check the Reviewer should ALWAYS run (it should have been caught in Discovery / Design / Review). Fix the matching GLOBAL phase file: read it with ${READ_PHASE_RULE}, then patch it with ${EDIT_PHASE_RULE} (discovery | design | breakdown | worker | reviewer). This edit is left UNCOMMITTED for the user to review.
- TASK-SPECIFIC gap — a one-off hole in THIS task's wording or acceptance criteria. Fix the project doc: read it with read_file, then patch the task's backlog file (or PRODUCT_SPEC.md) with edit_file.
- You may inspect first with read_file / list_files / search_in_files / ${READ_PHASE_RULE}.
- Make the SMALLEST correct edit — do not rewrite a whole phase or a whole doc.
- Patch EXACTLY ONE file. If the fix seems to belong in two places, you mis-classified — re-check and pick the single correct one.
- When the edit is done, call ${SUBMIT_RETRO} EXACTLY ONCE with { scope, rootCause } (rootCause = one sentence). Do not call any tool after ${SUBMIT_RETRO}.`;
}
