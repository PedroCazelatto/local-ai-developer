// Route the window's single edit to its authoritative fate BY RESOLVED PATH, never by the model's
// claim.
//
// A file under rules/phases/ is SYSTEMIC: never auto-committed, returned with a loud review warning,
// because the orchestrator's own instruction set must never mutate silently (constitution). A file
// under the project is TASK-SPECIFIC and commits with the project's work. A file under NEITHER should
// be impossible given the root-scoped tools, so it is a hard error that commits nothing.
//
// Named routeRetroEdit rather than the module-private `routeEdit` it was extracted from.

import path from 'node:path';

import { PHASES_DIR } from '../../context/phase-prompt.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import { buildRetroCommitMessage } from './build-retro-commit-message.js';
import { commitPaths } from './commit-paths.js';
import { isPathUnder } from './is-path-under.js';
import { RetroError } from './retro-error.js';
import type { RetroDeps } from './retro-deps.type.js';
import type { RetroResult } from './retro-result.type.js';
import type { RetroSubmission } from './retro-submission.type.js';
import type { Task } from './task.type.js';

/**
 * Route the window's single edit to its authoritative fate BY RESOLVED PATH (never the model's claim):
 * a file under rules/phases/ is SYSTEMIC — never auto-committed, returned with a loud review warning; a
 * file under the project is TASK-SPECIFIC — committed via the V2/03 commit flow. A file under neither
 * (should be impossible given the root-scoped tools) is a hard error, committing nothing.
 */
export function routeRetroEdit(
  deps: RetroDeps,
  task: Task,
  editedAbs: string,
  submission: RetroSubmission,
  tokens: TokenCounts,
): RetroResult {
  if (isPathUnder(editedAbs, PHASES_DIR)) {
    const rel = `rules/phases/${path.basename(editedAbs)}`;
    return {
      scope: 'systemic',
      rootCause: submission.rootCause,
      editedFile: editedAbs,
      committed: false,
      reviewWarning:
        `A GLOBAL phase instruction file was patched: ${rel}. It is UNCOMMITTED. Review the change and ` +
        `commit it MANUALLY in the orchestrator repo before continuing — the orchestrator's own ` +
        `instruction set must never mutate silently (constitution).`,
      tokens,
    };
  }
  if (isPathUnder(editedAbs, deps.projectPath)) {
    const rel = path.relative(deps.projectPath, editedAbs);
    // commitPaths stages ONLY this path and refuses anything escaping the project repo (defense in depth
    // behind this path guard) — a rules edit could never ride along here even if mis-routed.
    const commit = commitPaths(deps.projectPath, buildRetroCommitMessage(task, submission.rootCause), [rel]);
    const result: RetroResult = {
      scope: 'task-specific',
      rootCause: submission.rootCause,
      editedFile: editedAbs,
      committed: commit.committed,
      tokens,
    };
    if (!commit.committed) {
      return { ...result, reviewWarning: `Retro edited ${rel} but the commit failed: ${commit.error ?? 'unknown error'}. Commit it manually.` };
    }
    return result;
  }
  throw new RetroError(`Retro edited a file outside both rules/phases and the project: ${editedAbs}`);
}
