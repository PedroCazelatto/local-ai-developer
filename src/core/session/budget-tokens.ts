// One budget, in tokens, derived from the session's base ceiling — the arithmetic half of
// budget-fractions.ts. Every model-facing budget is read through here, so none of them can stop moving
// with OLLAMA_NUM_CTX.

import { BUDGET_FRACTIONS } from './budget-fractions.js';

/** A row of the fraction table. */
export type BudgetName = keyof typeof BUDGET_FRACTIONS;

/**
 * `baseNumCtx × fraction` for the named budget, rounded down. Integer arithmetic throughout — the
 * product is taken before the division — so a fraction with no exact float cannot round one under.
 */
export function budgetTokens(name: BudgetName, baseNumCtx: number): number {
  const { numerator, denominator } = BUDGET_FRACTIONS[name];
  return Math.floor((baseNumCtx * numerator) / denominator);
}
