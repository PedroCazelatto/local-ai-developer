// What the failed Worker actually produced, for Retro to read. Bounded, because it is fed straight
// into a Retro window sized by num_ctx.

import { truncateHeadTailToTokens } from '../../tools/truncate-head-tail-to-tokens.js';
import { findTaskStashRef } from './find-task-stash-ref.js';
import { runGit } from './run-git.js';

/**
 * The task's stashed attempt as a bounded diff (tracked edits + new files via `--include-untracked`),
 * for Retro to read what the failed Worker produced — or null if the task has no stash. Truncated to
 * `budget` tokens (budget-tokens.ts, `reviewDiff`) so a huge attempt can't blow past num_ctx when fed to
 * the Retro window.
 */
export function readTaskStashDiff(projectPath: string, taskId: string, budget: number): string | null {
  // findTaskStashRef: resolves `stash@{n}` by the task-keyed LABEL, so it survives later stashes.
  const ref = findTaskStashRef(projectPath, taskId);
  if (ref === null) return null;
  const show = runGit(projectPath, ['--no-pager', 'stash', 'show', '-p', '--include-untracked', ref]);
  const diff = show.stdout.trim();
  // truncateHeadTailToTokens: keeps the head and the tail and elides the middle, to fit `budget` tokens.
  return diff === '' ? null : truncateHeadTailToTokens(diff, budget).text;
}
