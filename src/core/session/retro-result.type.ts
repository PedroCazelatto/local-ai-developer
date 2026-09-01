// The routed outcome of one Retro: the single patched file plus its authoritative, path-derived fate.

import type { RetroScope } from './retro-scope.type.js';
import type { TokenCounts } from '../llm/index.js';

/** The routed outcome of one Retro: the single patched file + its authoritative (path-derived) fate. */
export interface RetroResult {
  /** Authoritative scope, derived from where the edited file resolved (NOT the model's claim). */
  readonly scope: RetroScope;
  /** One-sentence root-cause diagnosis the model submitted. */
  readonly rootCause: string;
  /** Absolute path of the single file Retro patched. */
  readonly editedFile: string;
  /** true ONLY for a task-specific edit that committed cleanly; always false for a systemic edit. */
  readonly committed: boolean;
  /** Present for a systemic edit (the loud "review + commit the rules change manually" warning), or a
   * task-specific edit whose commit failed. Absent on a clean task-specific commit. */
  readonly reviewWarning?: string;
  /** EXACT summed tokens across every turn of the Retro window (never estimated — constitution). */
  readonly tokens: TokenCounts;
}
