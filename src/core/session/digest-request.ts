// The distiller's input: the claim, the reasoning it was made from, and the argument in order.
//
// The material is deliberately NOT repeated here — the two debaters already quoted whatever mattered,
// and a large `background` replayed a third time is exactly the num_ctx spend this loop exists to
// avoid.

import type { DebateRequest } from './debate-request.type.js';
import type { DebateTurn } from './debate-turn.type.js';

/** The distiller's input: the claim, the reasoning behind it, and the argument in order. */
export function digestRequest(request: DebateRequest, transcript: readonly DebateTurn[]): string {
  const exchange = transcript
    .map((turn) => `### ${turn.role.toUpperCase()} (round ${turn.round}${turn.conceded ? ', conceded' : ''})\n\n${turn.body}`)
    .join('\n\n');
  return (
    `## Claim\n\n${request.claim}\n\n## The reasoning behind the claim\n\n${request.reasoning}\n\n` +
    `## The debate\n\n${exchange}\n\nReport where this debate landed, as the JSON object.`
  );
}
