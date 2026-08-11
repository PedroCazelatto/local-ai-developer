// Types for compose-commit-message.ts (constitution: types live in a sibling file, never inline).

import type { Message, OneShotResult, OneShotRole } from '../core/llm/index.js';

export interface ComposeCommitMessageInput {
  /**
   * ToolContext.oneShot — a fresh, HISTORY-FREE call to the session model. Passed in rather than
   * imported so the writer never reaches for the session's client itself (dependency inversion), and
   * so the committing phase's own context is provably untouched. Takes the role, like the context it
   * comes from, so this file names the ceiling it runs under rather than inheriting one silently.
   */
  readonly oneShot: (messages: Message[], role: OneShotRole) => Promise<OneShotResult>;
  /** The real `git diff` of exactly the paths being staged — the writer's primary evidence. */
  readonly diff: string;
  /** The committing phase's one-line statement of WHY these files changed. Context, not the message. */
  readonly intent: string;
  /** Project-relative paths in this commit — listed for the writer when the diff is empty/truncated. */
  readonly paths: readonly string[];
}
