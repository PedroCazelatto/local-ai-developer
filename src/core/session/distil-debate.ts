// Hand the finished argument to a THIRD context and validate what comes back.
//
// Neither debater grades its own fight: a local model asked whether its objections still stand finds
// that they all do. That is the entire reason a third window exists.
//
// ONE re-prompt on unusable output — the transcript is already paid for, so a reformat request is far
// cheaper than the debate it would otherwise discard. Two failures give up (null); the caller turns
// that into a recoverable tool error rather than an invented verdict.
//
// Named distilDebate rather than the module-private `distil` it was extracted from.

import type { Message, TokenCounts } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import type { DebateDeps } from './debate-deps.type.js';
import type { DebateDigest } from './debate-digest.type.js';
import type { DebateRequest } from './debate-request.type.js';
import type { DebateTurn } from './debate-turn.type.js';
import { digestRequest } from './digest-request.js';
import { parseDebateDigest } from './parse-debate-digest.js';

/** Sent once when the distiller's first reply carried no usable JSON object. */
const REFORMAT_REQUEST =
  'That reply was not one JSON object. Return ONLY the JSON object your instructions describe — ' +
  '"survived" as a JSON boolean (true or false, unquoted), "standing_objections" and "held_up" as ' +
  'arrays of strings, "revise" as a string. No fence, no preamble, no prose after it.';

/** Distil the transcript into a digest on a third context, re-prompting once on unusable output. */
export async function distilDebate(
  deps: DebateDeps,
  prompt: string,
  request: DebateRequest,
  transcript: readonly DebateTurn[],
): Promise<{ readonly digest: DebateDigest | null; readonly tokens: TokenCounts }> {
  const messages: Message[] = [
    { role: 'system', content: prompt },
    // digestRequest: the claim, the reasoning, and the argument in order — never the material again.
    { role: 'user', content: digestRequest(request, transcript) },
  ];
  const first = await deps.oneShot(messages, 'debate-digest');
  let tokens = first.tokens;
  // parseDebateDigest: the untrusted reply validated into a digest — null when it carries no boolean
  // verdict, which is the one field that cannot be defaulted.
  const parsed = parseDebateDigest(first.content);
  if (parsed !== null) return { digest: parsed, tokens };

  messages.push({ role: 'assistant', content: first.content });
  messages.push({ role: 'user', content: REFORMAT_REQUEST });
  const retry = await deps.oneShot(messages, 'debate-digest');
  // addTokenCounts: exact sums; a null metric poisons the total rather than reading as 0.
  tokens = addTokenCounts(tokens, retry.tokens);
  return { digest: parseDebateDigest(retry.content), tokens };
}
