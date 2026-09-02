// Pull the questions array out of whatever shape the model actually sent an ask_user call in.
//
// Forgiving about STRUCTURE, and only about structure: a batch handed over as a JSON string, a single
// question sent unwrapped, or one splatted straight onto the args are all syntax slips a 7B makes
// reliably, and bouncing them costs a round-trip and teaches nothing. Whether the questions are any
// GOOD is a different question, answered strictly by parse-one-question.ts.

import { loadsOrRepair } from '../core/llm/loads-or-repair.js';

/** Pull the questions array out of whatever the model actually sent. */
export function extractQuestionList(args: Record<string, unknown>): unknown[] | null {
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
