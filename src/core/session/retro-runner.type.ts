// Types for the V3/03 Retro phase (sibling of retro-runner.ts; constitution: types live beside the
// function they serve). Retro is spawned after the user resolves a Reviewer blocker: it diagnoses the
// root cause and patches ONE file so the misunderstanding cannot recur — a SYSTEMIC gap edits a global
// phase file under rules/phases/ (left uncommitted + a review warning), a TASK-SPECIFIC gap edits the
// project doc (committed with the project's work). The scope reported here is derived from the RESOLVED
// edited path (the orchestrator's path guard), never from the model's self-declared scope.

import type { SandboxClient } from '../container/index.js';
import type { OllamaClient, TokenCounts, Tool } from '../llm/index.js';
import type { Task } from './types.js';

/** Where the fix belongs — decided by the resolved edited-file path, not the model's claim. */
export type RetroScope = 'systemic' | 'task-specific';

export const RETRO_SCOPES: readonly RetroScope[] = ['systemic', 'task-specific'];

/** The model's own classification + one-sentence diagnosis, captured via submit_retro (advisory). */
export interface RetroSubmission {
  /** The model's claimed scope — advisory only; the path guard is authoritative for the commit decision. */
  readonly scope: RetroScope;
  /** One-sentence root-cause diagnosis (what upstream gap let the ambiguous task reach execution). */
  readonly rootCause: string;
}

/** What the Retro window is told: the task that blocked, the confusion, and the user's resolving answer. */
export interface RetroInput {
  /** The task that blocked — same definition the Worker/Reviewer saw. */
  readonly task: Task;
  /** The blocker question the Reviewer raised (what it was confused about). */
  readonly misunderstanding: string;
  /** The user's resolving answer (from /answer). */
  readonly answer: string;
}

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

/** The session infrastructure the Retro window binds to (supplied by the orchestrator). */
export interface RetroDeps {
  readonly llm: OllamaClient;
  /** The full registry tool set (toolDefinitions()); filtered here to the project read/edit subset. */
  readonly tools: Tool[];
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
}
