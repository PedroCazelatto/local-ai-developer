// What runDebate needs from its caller: one throwaway model call, and somewhere to send each finished
// turn. Injected rather than imported, so the loop stays pure orchestration and prints nothing itself.

import type { Message } from 'ollama';

import type { DebateTurn } from './debate-turn.type.js';
import type { DebateWindow } from './debate-window.type.js';
import type { SpawnedMemory } from './spawned-memory.js';
import type { OneShotRole } from '../llm/one-shot-role.type.js';
import type { OneShotResult } from '../llm/one-shot.js';

/** What runDebate needs: one throwaway model call, and somewhere to send each finished turn. */
export interface DebateDeps {
  /**
   * A fresh, history-free call to the session model (`ctx.oneShot` / `oneShot(client, …)`). Called once
   * per debate turn plus once or twice for the digest; NONE of those turns enter any phase's memory.
   *
   * The loop passes `debate-turn` for an argument and `debate-digest` for the distillation, so the two
   * are separable later. Both resolve to the BASE ceiling today, and must until a measurement says
   * otherwise. `background` is capped now (tools/debate.ts), but a debate window still GROWS — every
   * round adds a turn — and the bounded group's defining property is an input with a known hard maximum.
   * Whether a measured peak would let either role take a reduced ceiling is backlog item 43.
   */
  oneShot(messages: Message[], role: OneShotRole): Promise<OneShotResult>;
  /** Called as each turn completes, so the argument prints live rather than in one block at the end. */
  onTurn(turn: DebateTurn): void;
  /**
   * Open one of the debate's windows in memory.db (`debate-<window>:spawned`) with its failsafe — the
   * challenger and proponent compact at the threshold, the short digest is only recorded (#22a, #82a).
   */
  openWindow(window: DebateWindow): SpawnedMemory;
}
