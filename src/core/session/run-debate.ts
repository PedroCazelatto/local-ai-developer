// runDebate — the model-to-model deliberation loop: one local model, three throwaway context windows,
// arguing a claim before the calling phase commits to it (backlog/model-to-model-dialogue.md).
//
// One model, many context windows (docs/mental-model.md). A CHALLENGER window attacks the claim, a
// PROPONENT window defends it, and a third window distils where the argument landed. All three run on
// `oneShot` — same model, same num_ctx, no tools, never appended to any phase's memory — so the calling
// phase pays context for the DIGEST alone, not for the argument that produced it. Sequential by
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

import { loadPrompt } from '../../context/load-prompt.js';
import type { Message, TokenCounts } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { parseDebateDigest } from './parse-debate-digest.js';
import type {
  DebateDeps,
  DebateDigest,
  DebateOutcome,
  DebateRequest,
  DebateTurn,
} from './run-debate.type.js';

/**
 * Hard ceiling on challenger turns, enforced here and not settable by the model — the same rule as
 * MAX_TOOL_ROUNDS and SUBAGENT_MAX_ROUNDS. Five is enough for an objection to be raised, answered,
 * sharpened, answered again and closed; past that a local model repeats itself, and every extra round
 * is VRAM and wall-clock spent on a decision the digest could already have reported.
 */
export const MAX_DEBATE_ROUNDS = 5;

/** The three orchestrator-owned prompts under rules/prompts/ (never in the search_rules catalog). */
const CHALLENGER_PROMPT = 'debate-challenger';
const PROPONENT_PROMPT = 'debate-proponent';
const DIGEST_PROMPT = 'debate-digest';

/** The challenger's mandatory first line. Anything else is read as "still objecting" — see readStatus. */
const STATUS_LINE = /^[^\S\r\n]*status[^\S\r\n]*:[^\S\r\n]*(objecting|conceded)[^\S\r\n]*\r?\n?/i;

/** Sent once when the distiller's first reply carried no usable JSON object. */
const REFORMAT_REQUEST =
  'That reply was not one JSON object. Return ONLY the JSON object your instructions describe — ' +
  '"survived" as a JSON boolean (true or false, unquoted), "standing_objections" and "held_up" as ' +
  'arrays of strings, "revise" as a string. No fence, no preamble, no prose after it.';

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

  let nextForChallenger = openingObjectionRequest(request);
  let proponentSeeded = false;

  for (let round = 1; round <= MAX_DEBATE_ROUNDS; round += 1) {
    challenger.push({ role: 'user', content: nextForChallenger });
    const attack = await deps.oneShot(challenger);
    tokens = addTokenCounts(tokens, attack.tokens);
    challenger.push({ role: 'assistant', content: attack.content });

    const status = readStatus(attack.content);
    if (status.body === '') break; // nothing said — the argument is over, whatever the status claimed
    rounds = round;
    conceded = status.conceded;
    const objection: DebateTurn = { role: 'challenger', round, body: status.body, conceded };
    transcript.push(objection);
    deps.onTurn(objection);
    if (conceded) break; // the challenger ran out of real objections: the claim held

    proponent.push({
      role: 'user',
      content: proponentSeeded ? nextObjection(status.body, round) : openingDefenceRequest(request, status.body),
    });
    proponentSeeded = true;
    const defence = await deps.oneShot(proponent);
    tokens = addTokenCounts(tokens, defence.tokens);
    proponent.push({ role: 'assistant', content: defence.content });

    const body = defence.content.trim();
    if (body === '') break; // an empty defence ends the argument; the digest reports what stands
    const rebuttal: DebateTurn = { role: 'proponent', round, body, conceded: false };
    transcript.push(rebuttal);
    deps.onTurn(rebuttal);
    nextForChallenger = nextDefence(body, round + 1);
  }

  if (transcript.length === 0) {
    return { ok: false, rounds, conceded, tokens, failure: 'no-argument' };
  }

  const distilled = await distil(deps, digestPrompt, request, transcript);
  tokens = addTokenCounts(tokens, distilled.tokens);
  if (distilled.digest === null) {
    return { ok: false, rounds, conceded, tokens, failure: 'unreadable-digest' };
  }
  return { ok: true, rounds, conceded, tokens, digest: distilled.digest };
}

/**
 * Hand the finished argument to a THIRD context and validate what comes back. Neither debater grades
 * its own fight: a local model asked whether its objections still stand finds that they all do.
 *
 * One re-prompt on unusable output — the transcript is already paid for, so a reformat request is far
 * cheaper than the debate it would otherwise discard. Two failures give up (null); the caller turns
 * that into a recoverable tool error rather than an invented verdict.
 */
async function distil(
  deps: DebateDeps,
  prompt: string,
  request: DebateRequest,
  transcript: readonly DebateTurn[],
): Promise<{ readonly digest: DebateDigest | null; readonly tokens: TokenCounts }> {
  const messages: Message[] = [
    { role: 'system', content: prompt },
    { role: 'user', content: digestRequest(request, transcript) },
  ];
  const first = await deps.oneShot(messages);
  let tokens = first.tokens;
  // parseDebateDigest: the untrusted reply validated into a digest — null when it carries no boolean
  // verdict, which is the one field that cannot be defaulted.
  const parsed = parseDebateDigest(first.content);
  if (parsed !== null) return { digest: parsed, tokens };

  messages.push({ role: 'assistant', content: first.content });
  messages.push({ role: 'user', content: REFORMAT_REQUEST });
  const retry = await deps.oneShot(messages);
  tokens = addTokenCounts(tokens, retry.tokens);
  return { digest: parseDebateDigest(retry.content), tokens };
}

/**
 * Split the challenger's mandatory `STATUS:` line off its prose. A reply with no status line is read as
 * STILL OBJECTING: a concession ends the debate early, so it must be stated explicitly and never
 * inferred from a model that forgot the format.
 */
function readStatus(raw: string): { readonly conceded: boolean; readonly body: string } {
  const match = STATUS_LINE.exec(raw.trimStart());
  if (match?.[1] === undefined) return { conceded: false, body: raw.trim() };
  return {
    conceded: match[1].toLowerCase() === 'conceded',
    body: raw.trimStart().slice(match[0].length).trim(),
  };
}

/** The material section, or nothing at all — an empty "Material:" header would invite invention. */
function materialSection(request: DebateRequest): string {
  const background = request.background?.trim();
  return background === undefined || background === '' ? '' : `\n## Material\n\n${background}\n`;
}

/** One line telling the challenger where it is in its budget, so it spends its strongest ground first. */
function budgetLine(turn: number): string {
  return `This is turn ${turn} of at most ${MAX_DEBATE_ROUNDS}.`;
}

/** The challenger's seed: the claim and the material, never the caller's reasoning for it. */
function openingObjectionRequest(request: DebateRequest): string {
  return (
    `## Claim\n\n${request.claim}\n${materialSection(request)}\n` +
    `${budgetLine(1)} Raise your strongest objection to the claim now.`
  );
}

/** The proponent's seed: the claim, the caller's own reasoning, the material, and what to answer. */
function openingDefenceRequest(request: DebateRequest, objection: string): string {
  return (
    `## Claim\n\n${request.claim}\n\n## Your reasoning\n\n${request.reasoning}\n${materialSection(request)}\n` +
    `## Objection (round 1)\n\n${objection}\n\nAnswer this objection, or concede it.`
  );
}

/** Every later objection handed to the proponent — its window already holds the claim and material. */
function nextObjection(objection: string, round: number): string {
  return `## Objection (round ${round})\n\n${objection}\n\nAnswer this objection, or concede it.`;
}

/** Every defence handed back to the challenger, with its remaining budget. */
function nextDefence(defence: string, turn: number): string {
  return (
    `## The defence answers\n\n${defence}\n\n${budgetLine(turn)} ` +
    'Concede unless you have an objection that is both new and real.'
  );
}

/**
 * The distiller's input: the claim, the reasoning it was made from, and the argument in order. The
 * material is deliberately NOT repeated here — the two debaters already quoted whatever mattered, and
 * a large `background` replayed a third time is exactly the num_ctx spend this loop exists to avoid.
 */
function digestRequest(request: DebateRequest, transcript: readonly DebateTurn[]): string {
  const exchange = transcript
    .map((turn) => `### ${turn.role.toUpperCase()} (round ${turn.round}${turn.conceded ? ', conceded' : ''})\n\n${turn.body}`)
    .join('\n\n');
  return (
    `## Claim\n\n${request.claim}\n\n## The reasoning behind the claim\n\n${request.reasoning}\n\n` +
    `## The debate\n\n${exchange}\n\nReport where this debate landed, as the JSON object.`
  );
}
