// One side's contribution to one round, as it is handed to `onTurn` for rendering live.

import type { DebateRole } from './debate-role.type.js';

/** One side's contribution to one round, as it is handed to `onTurn` for rendering. */
export interface DebateTurn {
  readonly role: DebateRole;
  /** 1-based; a round is one challenger objection plus the proponent's answer to it. */
  readonly round: number;
  /** The prose, with the challenger's `STATUS:` line already stripped. Never empty. */
  readonly body: string;
  /** True on the challenger turn that ended the debate by conceding. Always false for the proponent. */
  readonly conceded: boolean;
}
