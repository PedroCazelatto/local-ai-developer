// ask_user — put a round of multiple-choice questions to the user and block on the answers. The
// planning phases exist to interview the user (CLAUDE.md: "the user is questioned about every
// meaningful detail"), and until now the only way to ask was prose the user had to read, parse, and
// answer by hand in one paragraph. This makes a question a real interaction: a tabbed panel, arrow
// keys, one answer per question.
//
// INTERACTIVE PHASES ONLY. It is registered globally (like every registry tool) but the orchestrator
// withholds it from spawned execution windows — the same mechanism that withholds the sub-agent
// tools. A Worker asking a question mid-batch would stall an unattended overnight run on a keypress
// nobody is there to press; execution windows escalate through the Reviewer's raise_blocker instead,
// which is asynchronous by design (CLAUDE.md).
//
// Unanswered questions are not lost and must not be re-asked: they are saved to the question store
// and re-offered by /questions whenever the user chooses, and their answers are injected into this
// phase's context on its next turn.

import { saveUnansweredQuestions } from '../core/session/question-store.js';
import { askQuestions } from '../core/ui/ask-questions.js';
import { parseAskQuestions } from './parse-ask-questions.js';
import { toolError } from './types.js';
import type { ToolModule, ToolResult } from './types.js';

/** The one name the orchestrator filters out of the spawned execution windows' tool list. */
export const ASK_USER = 'ask_user';

export const askUserTool: ToolModule = {
  name: ASK_USER,
  description:
    'Ask the user a round of up to 5 multiple-choice questions and WAIT for their answers. Use this ' +
    'instead of writing questions as prose whenever you need a decision from the user — it is the ' +
    'normal way to interview them. Each question needs at least 2 concrete, mutually exclusive ' +
    'options; a free-text choice is added automatically, so never add your own "other" option. ' +
    'Returns { answered: [{ question, answer }], unanswered: [{ id, question }] }. The user may skip ' +
    'questions: a skipped one is saved and answered later, so proceed with what you were given and ' +
    'NEVER re-ask an unanswered question.',
  parameters: {
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        description: 'The round of questions, 1 to 5 of them. Ask the most important ones first.',
        items: {
          type: 'object',
          required: ['question', 'options'],
          properties: {
            question: {
              type: 'string',
              description: 'The question, as one clear sentence a person can answer without context.',
            },
            options: {
              type: 'array',
              description:
                'At least 2 concrete, mutually exclusive answers to choose from. Make them real ' +
                'candidate answers, not placeholders — they are your best guesses at what the user wants.',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },

  async execute(ctx, args): Promise<ToolResult> {
    // parseAskQuestions: tolerate the shapes a 7B emits (a JSON-string batch, an unwrapped single
    // question), but reject a question with fewer than 2 real options as a recoverable error.
    const parsed = parseAskQuestions(args);
    if (!parsed.ok) {
      return toolError(parsed.error, 'Send { questions: [{ question, options: [...] }, ...] } with 1-5 questions.');
    }
    // askQuestions: draw the tabbed panel and block until the user submits on the Review tab or
    // closes it. Answers come back index-aligned; a null is a question they moved past, not a failure.
    const outcome = await askQuestions(ctx.phase, parsed.questions);
    const answered = parsed.questions
      .map((question, index) => ({ question: question.question, answer: outcome.answers[index] }))
      .filter((entry): entry is { question: string; answer: string } => entry.answer !== null && entry.answer !== undefined);
    const skipped = parsed.questions.filter((_question, index) => outcome.answers[index] === null);
    // saveUnansweredQuestions: append an `asked` row per skipped question, minting its id at write
    // time. /questions re-offers them later; the answers reach this phase on a later turn.
    const saved = saveUnansweredQuestions(ctx.projectPath, ctx.phase, skipped);
    // The panel erased its own frame and left its transcript; this is the one-line tally beside it.
    // A skipped question is SAVED, not lost, and the count says so rather than reading as a drop.
    const tally =
      saved.length === 0
        ? `${answered.length} answered`
        : `${answered.length} answered, ${saved.length} saved for later`;
    return {
      display: { summary: tally },
      content: {
        answered,
        unanswered: saved.map((question) => ({ id: question.id, question: question.question })),
        // Said plainly, because the failure mode is a model that re-asks a skipped question forever.
        note:
          saved.length === 0
            ? 'Every question was answered. Continue with these answers.'
            : `${saved.length} question(s) were left unanswered and have been SAVED — the user answers them ` +
              'when they choose, and the answers will be given to you then. Do not ask them again. Continue ' +
              'with the answers you did get.',
      },
    };
  },
};
