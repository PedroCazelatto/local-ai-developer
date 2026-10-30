// Tab candidates for /run. Split out of run.ts.

import { allTasks } from '../../core/session/all-tasks.js';
import { readBacklog } from '../../core/session/read-backlog.js';
import type { CompletionContext } from '../completion-context.type.js';

/**
 * Tab candidates for `/run <selector>`: the two static selectors plus every not-done task id. That is a
 * SUPERSET of what `all` sweeps, by one status: a `failed` task is offered here and skipped by `all`,
 * because naming it explicitly is the retry gesture and the id has to be typeable for that to work.
 * Only the selector is completable; a comma list past the first id isn't (the partial word carries the
 * commas with it).
 */
export function completeRun(ctx: CompletionContext): string[] {
  if (ctx.args.length > 0) return [];
  try {
    // readBacklog is a SYNC file read, which is what makes it safe in a completer that must never await
    // (complete-line.ts). A missing or malformed backlog just means no ids to offer, never a thrown Tab.
    const ids = allTasks(readBacklog(ctx.orch.projectPath))
      .filter((t) => t.status !== 'done')
      .map((t) => t.id);
    return ['next', 'all', ...ids];
  } catch {
    return ['next', 'all'];
  }
}
