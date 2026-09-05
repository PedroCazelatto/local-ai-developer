// The CHALLENGER's seed: the claim and the material, and deliberately NOT the caller's reasoning.
//
// Withholding the reasoning is the asymmetry the whole loop rests on — the challenger's objections are
// then its own, rather than a critique of how the caller happened to word its case.

import { debateBudgetLine } from './debate-budget-line.js';
import { debateMaterialSection } from './debate-material-section.js';
import type { DebateRequest } from './debate-request.type.js';

/** The challenger's seed: the claim and the material, never the caller's reasoning for it. */
export function openingObjectionRequest(request: DebateRequest): string {
  return (
    `## Claim\n\n${request.claim}\n${debateMaterialSection(request)}\n` +
    `${debateBudgetLine(1)} Raise your strongest objection to the claim now.`
  );
}
