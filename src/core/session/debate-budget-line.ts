// One line telling the challenger where it is in its budget, so it spends its strongest ground first
// rather than saving it for a turn that never comes.

import { MAX_DEBATE_ROUNDS } from './max-debate-rounds.js';

/** One line telling the challenger where it is in its budget. */
export function debateBudgetLine(turn: number): string {
  return `This is turn ${turn} of at most ${MAX_DEBATE_ROUNDS}.`;
}
