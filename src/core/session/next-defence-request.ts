// Every defence handed back to the challenger, with its remaining budget and an explicit instruction to
// concede unless it has something both new and real — a local model will otherwise keep objecting
// forever rather than admit the point was answered.

import { debateBudgetLine } from './debate-budget-line.js';

/** Every defence handed back to the challenger, with its remaining budget. */
export function nextDefenceRequest(defence: string, turn: number): string {
  return (
    `## The defence answers\n\n${defence}\n\n${debateBudgetLine(turn)} ` +
    'Concede unless you have an objection that is both new and real.'
  );
}
