// runDebate — the model-to-model deliberation loop: one local model, three throwaway context windows,
// arguing a claim before the calling phase commits to it (backlog/model-to-model-dialogue.md).
//
// One model, many context windows (docs/mental-model.md). A CHALLENGER window attacks the claim, a
// PROPONENT window defends it, and a third window distils where the argument landed. All three run on
// `oneShot` — same model, no tools, never appended to any phase's memory — so the calling phase pays
// context for the DIGEST alone, not for the argument that produced it. All three also stay at the BASE
// num_ctx, because `background` is uncapped model-supplied text (see DebateDeps.oneShot). Sequential by
// construction: no parallelism anywhere in this project (docs/product.md), and a 3060 could not hold
// two slots anyway.
//
// The asymmetry is the design. The proponent is seeded with the caller's own reasoning AND the material,
// so it cannot lose on a fact it was never given; the challenger gets the claim and the material but
// NOT the reasoning, so its objections are its own rather than a critique of the caller's wording. The
// challenger also moves first — its opening objection is what there is to defend.
//
// Nothing here prints or persists. `onTurn` is where the caller renders each turn live, and the caller
// owns the events-log row; this file is the argument and nothing else.

import type { Message } from 'ollama';

import { loadPrompt } from '../../context/load-prompt.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import { addTokenCounts } from './add-token-counts.js';
import type { DebateDeps } from './debate-deps.type.js';
import type { DebateOutcome } from './debate-outcome.type.js';
import type { DebateRequest } from './debate-request.type.js';
import type { DebateTurn } from './debate-turn.type.js';
import { distilDebate } from './distil-debate.js';
import { MAX_DEBATE_ROUNDS } from './max-debate-rounds.js';
import { nextDefenceRequest } from './next-defence-request.js';
import { nextObjectionRequest } from './next-objection-request.js';
import { openingDefenceRequest } from './opening-defence-request.js';
import { openingObjectionRequest } from './opening-objection-request.js';
import { readChallengerStatus } from './read-challenger-status.js';

/** The three orchestrator-owned prompts under rules/prompts/ (never in the search_rules catalog). */
const CHALLENGER_PROMPT = 'debate-challenger';
const PROPONENT_PROMPT = 'debate-proponent';
const DIGEST_PROMPT = 'debate-digest';

/**
 * Run one debate to its digest. Never throws for a model-quality reason: an argument that produced
 * nothing and a digest that could not be read both come back as `ok: false` with the reason, carrying
 * the exact tokens they still cost. A missing prompt file (PromptNotFoundError) and a transport failure
 * DO propagate — those are faults the caller must surface, not debate outcomes.
 */
export async function runDebate(deps: DebateDeps, request: DebateRequest): Promise<DebateOutcome> {
  // loadPrompt reads rules/prompts/<name>.md fresh on every call, so editing a debate prompt takes
  // effect on the next debate with no restart. Read all three up front: a missing file must fail before
  // any inference is spent, not after the argument is already paid for.
  const challenger: Message[] = [{ role: 'system', content: loadPrompt(CHALLENGER_PROMPT) }];
  const proponent: Message[] = [{ role: 'system', content: loadPrompt(PROPONENT_PROMPT) }];
  const digestPrompt = loadPrompt(DIGEST_PROMPT);

  // Every call's EXACT counts fold into one running total; a metric Ollama omitted poisons the sum to
  // null rather than being read as 0 (constitution: token counts are always exact).
  let tokens: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  const transcript: DebateTurn[] = [];
  let conceded = false;
  let rounds = 0;

  // openingObjectionRequest: the claim and the material, never the caller's reasoning.
  let nextForChallenger = openingObjectionRequest(request);
  let proponentSeeded = false;

  for (let round = 1; round <= MAX_DEBATE_ROUNDS; round += 1) {
    challenger.push({ role: 'user', content: nextForChallenger });
    const attack = await deps.oneShot(challenger, 'debate-turn');
    tokens = addTokenCounts(tokens, attack.tokens);
    challenger.push({ role: 'assistant', content: attack.content });

    // readChallengerStatus: splits the mandatory STATUS: line off; no line ⇒ still objecting.
    const status = readChallengerStatus(attack.content);
    if (status.body === '') break; // nothing said — the argument is over, whatever the status claimed
    rounds = round;
    conceded = status.conceded;
    const objection: DebateTurn = { role: 'challenger', round, body: status.body, conceded };
    transcript.push(objection);
    deps.onTurn(objection);
    if (conceded) break; // the challenger ran out of real objections: the claim held

    proponent.push({
      role: 'user',
      content: proponentSeeded
        ? nextObjectionRequest(status.body, round)
        : openingDefenceRequest(request, status.body),
    });
    proponentSeeded = true;
    const defence = await deps.oneShot(proponent, 'debate-turn');
    tokens = addTokenCounts(tokens, defence.tokens);
    proponent.push({ role: 'assistant', content: defence.content });

    const body = defence.content.trim();
    if (body === '') break; // an empty defence ends the argument; the digest reports what stands
    const rebuttal: DebateTurn = { role: 'proponent', round, body, conceded: false };
    transcript.push(rebuttal);
    deps.onTurn(rebuttal);
    nextForChallenger = nextDefenceRequest(body, round + 1);
  }

  if (transcript.length === 0) {
    return { ok: false, rounds, conceded, tokens, failure: 'no-argument' };
  }

  // distilDebate: a third, neutral window, with one re-prompt when the reply is unreadable.
  const distilled = await distilDebate(deps, digestPrompt, request, transcript);
  tokens = addTokenCounts(tokens, distilled.tokens);
  if (distilled.digest === null) {
    return { ok: false, rounds, conceded, tokens, failure: 'unreadable-digest' };
  }
  return { ok: true, rounds, conceded, tokens, digest: distilled.digest };
}
