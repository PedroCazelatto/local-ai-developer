// What the Retro window is told: the task that blocked, the confusion, and the user's resolving
// answer. It sees NOTHING of the Worker's or Reviewer's turns (CLAUDE.md memory model).

import type { Task } from './task.type.js';

/** What the Retro window is told: the task that blocked, the confusion, and the user's resolving answer. */
export interface RetroInput {
  /** The task that blocked — same definition the Worker/Reviewer saw. */
  readonly task: Task;
  /** The blocker question the Reviewer raised (what it was confused about). */
  readonly misunderstanding: string;
  /** The user's resolving answer (from /answer). */
  readonly answer: string;
  /**
   * The failed Worker attempt that triggered the blocker, as a bounded stash diff (V3/05) — advisory
   * evidence so Retro can see HOW the ambiguity misled implementation. Absent if nothing was stashed. The
   * Worker never reuses it; a fresh Worker redoes the task from scratch.
   */
  readonly failedAttempt?: string;
}
