// /questions (V6/01) — re-open the questions the model asked and the user skipped. A user command,
// never a model tool: the model asks through ask_user, the user answers on their own schedule, here.
//
// It closes the loop ask_user opens. Skipping a question during a round is normal — the answer may
// need thought, or a look at something else first — so the question is saved rather than lost, and
// this is where the user comes back to it. Answers are handed to the phase that asked, on its next
// turn (SessionOrchestrator.deliverAnsweredQuestions), even across a phase swap or a restart.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// run-questions.ts drives the rounds, over group-questions-by-phase.ts which buckets them.

import type { Command } from '../command.type.js';
import { runQuestions } from './run-questions.js';

export const questionsCommand: Command = {
  name: 'questions',
  group: 'session',
  description: 'Answer the questions the model asked that you skipped',
  usage: '/questions',
  // runQuestions: one ask_user panel per asking phase, persisting each answer and leaving anything
  // skipped again in the store, then reporting how many are still saved.
  run: (ctx) => runQuestions(ctx.orch),
};
