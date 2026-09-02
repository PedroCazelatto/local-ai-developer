// Validate an ask_user payload into a question batch, or into a concrete message the model can fix
// its call from. Split out of ask-user.ts because the tool's job is to ASK; this one's job is to
// survive the shapes a small local model actually emits.
//
// It is forgiving about STRUCTURE and strict about SUBSTANCE. A 7B reliably knows what it wants to
// ask and unreliably knows how to nest JSON, so a batch handed over as a JSON string, or a single
// question sent unwrapped, is understood rather than rejected — that is a syntax slip, and bouncing
// it costs a round-trip and teaches nothing. But a question with no real options is a BAD QUESTION,
// not a bad encoding: it defeats the point of the tool (the user picks, they don't compose an essay),
// so it comes back as a recoverable error naming exactly what to send instead.

import type { AskQuestion } from '../core/ui/ask-questions.js';
import { extractQuestionList } from './extract-question-list.js'; // tolerates a JSON string or an unwrapped question
import { parseFailure } from './parse-failure.js';
import { parseOneQuestion } from './parse-one-question.js'; // strict about substance: at least two real options

/**
 * Bounded rounds, straight from rules/phases/discovery.md ("ask in focused rounds (5 questions max
 * per round) so the user isn't overwhelmed") — enforced here so the wall of questions can't be built
 * in the first place, rather than only being discouraged in prose the model may skim.
 */
const MAX_QUESTIONS = 5;

/** A validated question batch, or a message the model can read and correct its call from. */
export type AskQuestionsParse =
  | { readonly ok: true; readonly questions: AskQuestion[] }
  | { readonly ok: false; readonly error: string };

/** Validate an ask_user payload into a batch of 1..5 questions, or a message the model can act on. */
export function parseAskQuestions(args: Record<string, unknown>): AskQuestionsParse {
  const list = extractQuestionList(args);
  if (list === null) {
    return parseFailure('"questions" must be an array of { question, options } objects.');
  }
  if (list.length === 0) {
    return parseFailure('"questions" is empty — send at least one question.');
  }
  if (list.length > MAX_QUESTIONS) {
    return parseFailure(
      `${list.length} questions is too many for one round (max ${MAX_QUESTIONS}). Ask the most important ` +
        `${MAX_QUESTIONS} now; you can ask the rest in the next round, once these answers are in.`,
    );
  }
  const questions: AskQuestion[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const parsed = parseOneQuestion(list[index], index);
    if (!parsed.ok) return parseFailure(parsed.error);
    questions.push(parsed.question);
  }
  return { ok: true, questions };
}
