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

import { loadsOrRepair } from '../core/llm/index.js';
import type { AskQuestion } from '../core/ui/ask-questions.js';
import type { AskQuestionsParse } from './parse-ask-questions.type.js';

/**
 * Bounded rounds, straight from rules/phases/discovery.md ("ask in focused rounds (5 questions max
 * per round) so the user isn't overwhelmed") — enforced here so the wall of questions can't be built
 * in the first place, rather than only being discouraged in prose the model may skim.
 */
const MAX_QUESTIONS = 5;

/** Minimum real options per question — one option is not a choice, and zero is a text box. */
const MIN_OPTIONS = 2;

function invalid(error: string): AskQuestionsParse {
  return { ok: false, error };
}

/** Pull the questions array out of whatever the model actually sent. */
function extractList(args: Record<string, unknown>): unknown[] | null {
  const raw = args['questions'];
  if (Array.isArray(raw)) return raw;
  // A batch handed over as a JSON string — loadsOrRepair is the same lenient decoder the tool-call
  // pipeline already uses for a model that fences or half-escapes its JSON.
  if (typeof raw === 'string') {
    const decoded = loadsOrRepair(raw);
    if (Array.isArray(decoded)) return decoded;
    if (decoded !== null && typeof decoded === 'object') return [decoded];
  }
  // A single question sent unwrapped, either as `questions: {…}` or splatted onto the args themselves.
  if (raw !== null && typeof raw === 'object') return [raw];
  if (typeof args['question'] === 'string') return [args];
  return null;
}

/** Coerce one entry's options into a list of non-empty strings, tolerating a JSON-string list. */
function extractOptions(value: unknown): string[] | null {
  const list = typeof value === 'string' ? loadsOrRepair(value) : value;
  if (!Array.isArray(list)) return null;
  const options: string[] = [];
  for (const option of list) {
    if (typeof option !== 'string') return null;
    const trimmed = option.trim();
    if (trimmed !== '') options.push(trimmed);
  }
  return options;
}

/** Validate one entry into an AskQuestion. */
function parseOne(raw: unknown, index: number): { ok: true; question: AskQuestion } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `questions[${index}] must be an object with "question" and "options".` };
  }
  const record = raw as Record<string, unknown>;
  const question = record['question'];
  if (typeof question !== 'string' || question.trim() === '') {
    return { ok: false, error: `questions[${index}].question must be a non-empty string.` };
  }
  const options = extractOptions(record['options']);
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

/** Validate an ask_user payload into a batch of 1..5 questions, or a message the model can act on. */
export function parseAskQuestions(args: Record<string, unknown>): AskQuestionsParse {
  const list = extractList(args);
  if (list === null) {
    return invalid('"questions" must be an array of { question, options } objects.');
  }
  if (list.length === 0) {
    return invalid('"questions" is empty — send at least one question.');
  }
  if (list.length > MAX_QUESTIONS) {
    return invalid(
      `${list.length} questions is too many for one round (max ${MAX_QUESTIONS}). Ask the most important ` +
        `${MAX_QUESTIONS} now; you can ask the rest in the next round, once these answers are in.`,
    );
  }
  const questions: AskQuestion[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const parsed = parseOne(list[index], index);
    if (!parsed.ok) return invalid(parsed.error);
    questions.push(parsed.question);
  }
  return { ok: true, questions };
}
