// Types for verdict-git-conflict.ts (constitution: types live in a sibling file, never inline).

import type { ReviewVerdict } from './review-types.js';

export interface VerdictGitState {
  /** The parsed, shape-valid verdict the Reviewer just submitted. */
  readonly verdict: ReviewVerdict;
  /** Project-relative paths still uncommitted after the Reviewer's own commits this round. */
  readonly outstanding: readonly string[];
  /** True once the Reviewer called mark_task_done for the task under review. */
  readonly taskMarkedDone: boolean;
  /** Backlog id of the task under review — named in the error so the Reviewer knows what to close. */
  readonly taskId: string;
}
