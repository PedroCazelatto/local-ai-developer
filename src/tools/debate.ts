// debate — pressure-test a claim against a second context before committing to it. The model hands over
// one position, why it believes it, and the material it concerns; the orchestrator runs a bounded
// argument between a CHALLENGER window and a PROPONENT window, has a third window distil the result, and
// returns THAT digest as the tool result (runDebate — src/core/session/run-debate.ts).
//
// The point is what the caller does NOT pay for: the argument runs in throwaway contexts, so a five-round
// debate costs the calling phase the four digest fields and nothing else. This is why it is a tool rather
// than an instruction to spawn a sub-agent and argue by hand — that version puts every objection and
// every rebuttal into the caller's own num_ctx.
//
// Available to the five phases whose arrays name it (planning + Reviewer + Retro). The Worker is
// deliberately excluded — see phases/phase-tool-names.ts. Nothing is persisted: the transcript goes to
// the scrollback, the cost goes to the events log, and the windows die with the call.

import { appendEvent } from '../core/session/events-log.js';
import { runDebate } from '../core/session/run-debate.js';
import type { DebateOutcome, DebateRequest } from '../core/session/run-debate.type.js';
import { renderDebateSummary } from '../core/ui/render-debate-summary.js';
import { renderDebateTurn } from '../core/ui/render-debate-turn.js';
import type { JsonObject, StructuredToolResult, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const DEBATE = 'debate';

/** Why the model was told the debate produced nothing, per failure reason. Both are retryable. */
const FAILURE_MESSAGES = {
  'no-argument': 'the debate produced no argument: the challenger returned nothing.',
  'unreadable-digest': 'the debate ran but produced no usable digest.',
} as const;

const FAILURE_HINTS = {
  'no-argument': 'Retry with a claim stated as one concrete position, and put the material in `background`.',
  'unreadable-digest': 'Retry once, or decide from your own reasoning and say that the pressure-test was inconclusive.',
} as const;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const debateTool: ToolModule = {
  name: DEBATE,
  description:
    'Pressure-test a claim before you commit to it. A second context attacks the claim while a third ' +
    'defends it, for up to 5 rounds, and you get back a short digest: whether the claim survived, the ' +
    'objections that still stand, what held up, and what to change. The argument itself never enters ' +
    'your context — only the digest. Use it for a decision that is expensive to get wrong (an ' +
    'architectural boundary, a verdict, a diagnosis), not for an obvious call. Answer nothing yourself ' +
    'here: state the claim, your reasoning, and the material, then read the result.',
  parameters: {
    type: 'object',
    properties: {
      claim: {
        type: 'string',
        description:
          'The position to test, as ONE concrete statement in one or two sentences — e.g. "Sync the ' +
          'ledger through an outbox table". Not a question, and not a list of options.',
      },
      reasoning: {
        type: 'string',
        description:
          'Why you believe the claim. This seeds the defence, so include the argument you would make ' +
          'yourself. The challenger never sees it.',
      },
      background: {
        type: 'string',
        description:
          'Optional: the material the claim concerns — the constraint, the schema, the relevant file ' +
          'content — inline. Both sides argue from text only; neither can read a file, so anything you ' +
          'leave out is a fact the debate cannot use.',
      },
    },
    required: ['claim', 'reasoning'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const claim = args['claim'];
    const reasoning = args['reasoning'];
    const background = args['background'];
    if (typeof claim !== 'string' || claim.trim() === '') {
      return toolError("'claim' must be a non-empty string.", 'State the position to test as one concrete sentence.');
    }
    if (typeof reasoning !== 'string' || reasoning.trim() === '') {
      return toolError("'reasoning' must be a non-empty string.", 'Say why you believe the claim — it is what the defence argues from.');
    }
    // An absent `background` is normal (a claim can be self-contained); a non-string one is a bad call.
    if (background !== undefined && typeof background !== 'string') {
      return toolError("'background' must be a string when given.", 'Put the relevant material inline, or omit the field.');
    }
    const trimmedBackground = background?.trim() ?? '';
    const request: DebateRequest = {
      claim: claim.trim(),
      reasoning: reasoning.trim(),
      ...(trimmedBackground === '' ? {} : { background: trimmedBackground }),
    };

    let outcome: DebateOutcome;
    try {
      // runDebate: challenger ⇄ proponent for up to MAX_DEBATE_ROUNDS on throwaway one-shot contexts,
      // then a third context distils the transcript. onTurn renders each turn as it lands, so the user
      // reads the argument live; none of those turns enter this phase's memory.
      outcome = await runDebate({ oneShot: (messages) => ctx.oneShot(messages), onTurn: renderDebateTurn }, request);
    } catch (err) {
      // A missing rules/prompts/debate-*.md file or a transport failure — a real fault, surfaced to the
      // model as recoverable so the turn continues without the pressure-test.
      return toolError(`the debate could not run: ${messageOf(err)}`);
    }

    renderDebateSummary({
      rounds: outcome.rounds,
      conceded: outcome.conceded,
      survived: outcome.ok ? outcome.digest.survived : null,
      promptTokens: outcome.tokens.promptTokens,
      evalTokens: outcome.tokens.evalTokens,
    });

    // V5/04 events row: the debate's throwaway calls belong to no phase's history, so this log is the
    // only durable record of what they cost. Exact counts only — a metric Ollama omitted is OMITTED here
    // too, never zeroed. `survived` is present only when there is a verdict; a failure carries `failure`.
    appendEvent(ctx.projectPath, {
      type: 'debate',
      phase: ctx.phase,
      detail: {
        rounds: outcome.rounds,
        conceded: outcome.conceded,
        ...(outcome.ok ? { survived: outcome.digest.survived } : { failure: outcome.failure }),
      },
      ...(outcome.tokens.promptTokens !== null ? { promptTokens: outcome.tokens.promptTokens } : {}),
      ...(outcome.tokens.evalTokens !== null ? { evalTokens: outcome.tokens.evalTokens } : {}),
    });

    if (!outcome.ok) {
      return toolError(FAILURE_MESSAGES[outcome.failure], FAILURE_HINTS[outcome.failure]);
    }

    const content: JsonObject = {
      survived: outcome.digest.survived,
      standing_objections: [...outcome.digest.standingObjections],
      held_up: [...outcome.digest.heldUp],
      revise: outcome.digest.revise,
      // How hard the claim was actually tested. A concession is the strongest "it held" this loop can
      // report, and rounds says whether the verdict came from one exchange or five.
      rounds: outcome.rounds,
      conceded: outcome.conceded,
    };
    const objections = outcome.digest.standingObjections.length;
    const result: StructuredToolResult = {
      content,
      // The debate's EXACT cost on the audit row too, the way search_rules records its own one-shot.
      metadata: { debatePromptTokens: outcome.tokens.promptTokens, debateEvalTokens: outcome.tokens.evalTokens },
      // The verdict and what still stands against it — the two facts a reader of the transcript above
      // would otherwise have to re-derive. The argument itself already printed as it happened.
      display: {
        summary:
          `${outcome.digest.survived ? 'survived' : 'did not survive'} · ` +
          `${objections} standing objection${objections === 1 ? '' : 's'} · ${outcome.rounds} round${outcome.rounds === 1 ? '' : 's'}`,
      },
    };
    return result;
  },
};
