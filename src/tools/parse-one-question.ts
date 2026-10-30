// Validate ONE ask_user entry into an AskQuestion.
//
// This is where the tool is STRICT, and the strictness is the point: a question with no real options
// is a bad QUESTION, not a bad encoding. It defeats what ask_user is for -- the user picks, they do
// not compose an essay -- so it comes back as a recoverable error naming exactly what to send instead.
//
// It is `parseOneQuestion` rather than `parseOne`: `parse-one.ts` in a flat directory names no
// subject at all.

import type { AskQuestion } from '../core/ui/ask-questions.js';
// Coerces the options to non-empty strings, tolerating a JSON-string list; null if it is not a list.
import { extractQuestionOptions } from './extract-question-options.js';

/** Minimum real options per question — one option is not a choice, and zero is a text box. */
const MIN_OPTIONS = 2;

/** Validate one entry into an AskQuestion. */
export function parseOneQuestion(raw: unknown, index: number): { ok: true; question: AskQuestion } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `questions[${index}] must be an object with "question" and "options".` };
  }
  const record = raw as Record<string, unknown>;
  const question = record['question'];
  if (typeof question !== 'string' || question.trim() === '') {
    return { ok: false, error: `questions[${index}].question must be a non-empty string.` };
  }
  const options = extractQuestionOptions(record['options']);
  if (options === null) {
    return { ok: false, error: `questions[${index}].options must be an array of strings.` };
  }
  if (options.length < MIN_OPTIONS) {
    return {
      ok: false,
      error:
        `questions[${index}].options has ${options.length} option(s); give at least ${MIN_OPTIONS} concrete, ` +
        'mutually exclusive answers the user can choose between. A free-text choice is added for you — ' +
        'never send one yourself, and never ask a question whose only answer is an essay.',
    };
  }
  return { ok: true, question: { question: question.trim(), options } };
}
