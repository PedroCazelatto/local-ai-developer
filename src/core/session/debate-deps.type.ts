// What runDebate needs from its caller: one throwaway model call, and somewhere to send each finished
// turn. Injected rather than imported, so the loop stays pure orchestration and prints nothing itself.

import type { DebateTurn } from './debate-turn.type.js';
import type { Message, OneShotResult, OneShotRole } from '../llm/index.js';

/** What runDebate needs: one throwaway model call, and somewhere to send each finished turn. */
export interface DebateDeps {
  /**
   * A fresh, history-free call to the session model (`ctx.oneShot` / `oneShot(client, …)`). Called once
   * per debate turn plus once or twice for the digest; NONE of those turns enter any phase's memory.
   *
   * The loop passes `debate-turn` for an argument and `debate-digest` for the distillation, so the two
   * are separable later. Both resolve to the BASE ceiling today, and must: `background` is free text the
   * model writes and nothing caps it, so a reduced window would silently truncate the material the
   * argument is about (backlog/cap-the-debate-background-parameter.md). Capping it is the prerequisite
   * for either role joining the bounded group.
   */
  oneShot(messages: Message[], role: OneShotRole): Promise<OneShotResult>;
  /** Called as each turn completes, so the argument prints live rather than in one block at the end. */
  onTurn(turn: DebateTurn): void;
}
