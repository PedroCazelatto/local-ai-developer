// Type for parse-ask-questions.ts (constitution: types live in a sibling file, never inline).

import type { AskQuestion } from '../core/ui/ask-questions.type.js';

/** A validated question batch, or a message the model can read and correct its call from. */
export type AskQuestionsParse =
  | { readonly ok: true; readonly questions: AskQuestion[] }
  | { readonly ok: false; readonly error: string };
