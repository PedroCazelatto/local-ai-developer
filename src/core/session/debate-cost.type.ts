// What every debate outcome carries whether it succeeded or not -- the argument was paid for either way
// and the cost must be reported. Referenced only by DebateOutcome, which intersects it with each arm.

import type { TokenCounts } from '../llm/index.js';

/** Fields every outcome carries, successful or not — the cost was real either way and must be reported. */
export interface DebateCost {
  /** Completed rounds (challenger turns that produced prose), 0..MAX_DEBATE_ROUNDS. */
  readonly rounds: number;
  /** True when the challenger ran out of real objections and conceded before the cap. */
  readonly conceded: boolean;
  /** The EXACT summed Ollama counts for every call the debate made (a null metric poisons the sum). */
  readonly tokens: TokenCounts;
}
