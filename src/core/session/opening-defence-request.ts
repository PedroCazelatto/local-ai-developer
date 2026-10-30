// The PROPONENT's seed: the claim, the caller's own reasoning, the material, and the objection to
// answer. It gets the reasoning precisely so it cannot lose on a fact it was never given.

import { debateMaterialSection } from './debate-material-section.js';
import type { DebateRequest } from './debate-request.type.js';

/** The proponent's seed: the claim, the caller's own reasoning, the material, and what to answer. */
export function openingDefenceRequest(request: DebateRequest, objection: string): string {
  return (
    `## Claim\n\n${request.claim}\n\n## Your reasoning\n\n${request.reasoning}\n${debateMaterialSection(request)}\n` +
    `## Objection (round 1)\n\n${objection}\n\nAnswer this objection, or concede it.`
  );
}
