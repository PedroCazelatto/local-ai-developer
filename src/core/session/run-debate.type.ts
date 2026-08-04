// Types for the model-to-model deliberation loop (run-debate.ts). Kept in a sibling `.type.ts` per the
// constitution. The vocabulary is deliberately small: a REQUEST (what is being tested), the TURNS it
// produced (rendered as they land), and one OUTCOME the calling tool turns into its result.

import type { Message, OneShotResult, TokenCounts } from '../llm/index.js';

/** What the calling phase hands over: the position under test, plus the material to test it against. */
export interface DebateRequest {
  /** The one-or-two-sentence position being tested. */
  readonly claim: string;
  /** Why the caller believes it. Seeds the PROPONENT only — the challenger must find faults itself. */
  readonly reasoning: string;
  /** The files/constraints/facts the claim concerns, inline. Absent when the claim needs no material. */
  readonly background?: string;
}

/** The two sides. The challenger opens, since its first objection is what the proponent answers. */
export type DebateRole = 'proponent' | 'challenger';

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

/** The distilled report the calling phase actually reads — written by a third, neutral context. */
export interface DebateDigest {
  /** False when any objection was left unanswered or was conceded by the proponent. */
  readonly survived: boolean;
  /** The objections the defence never answered. Empty when none stand. */
  readonly standingObjections: readonly string[];
  /** The parts of the claim the defence established under attack. Empty when it established nothing. */
  readonly heldUp: readonly string[];
  /** One instruction: what to change before using the claim. Empty when nothing needs to change. */
  readonly revise: string;
}

/**
 * Why a debate produced no digest. Both are surfaced to the model as a recoverable tool error — never
 * papered over with an invented verdict (constitution: surface an absent value, do not guess it).
 *
 * - `no-argument`: the challenger's first reply was empty, so there was never an argument to distil.
 * - `unreadable-digest`: the distiller returned no valid JSON object, twice.
 */
export type DebateFailure = 'no-argument' | 'unreadable-digest';

/** What runDebate needs: one throwaway model call, and somewhere to send each finished turn. */
export interface DebateDeps {
  /**
   * A fresh, history-free call to the session model (`ctx.oneShot` / `oneShot(client, …)`). Called once
   * per debate turn plus once or twice for the digest; NONE of those turns enter any phase's memory.
   */
  oneShot(messages: Message[]): Promise<OneShotResult>;
  /** Called as each turn completes, so the argument prints live rather than in one block at the end. */
  onTurn(turn: DebateTurn): void;
}

/** Fields every outcome carries, successful or not — the cost was real either way and must be reported. */
interface DebateCost {
  /** Completed rounds (challenger turns that produced prose), 0..MAX_DEBATE_ROUNDS. */
  readonly rounds: number;
  /** True when the challenger ran out of real objections and conceded before the cap. */
  readonly conceded: boolean;
  /** The EXACT summed Ollama counts for every call the debate made (a null metric poisons the sum). */
  readonly tokens: TokenCounts;
}

/** One debate's result: the digest, or the reason there is none. Discriminated on `ok`. */
export type DebateOutcome =
  | (DebateCost & { readonly ok: true; readonly digest: DebateDigest })
  | (DebateCost & { readonly ok: false; readonly failure: DebateFailure });
