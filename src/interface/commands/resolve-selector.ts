// Turn /run's selector into the ordered task ids to attempt, and say whether it is a batch. Split out
// of run.ts.
//
// The batch/single distinction is DERIVED here and nowhere else: `all`, or a comma list of two or
// more ids, is unattended; `next` and a lone id are not. Deciding it in one place is what keeps
// dispatch-run.ts from having to re-read the selector's shape.

import { allTasks } from '../../core/session/all-tasks.js';
import { nextRunnableTasks } from '../../core/session/next-runnable-tasks.js';
import type { Backlog } from '../../core/session/backlog.type.js';

/** A resolved selector: the ordered task ids to attempt, and whether it is an unattended batch. */
export interface Selection {
  readonly ids: string[];
  readonly isBatch: boolean;
}

/** Resolve the selector to the ordered ids to attempt, and whether it is a batch (all, or 2+ ids). */
export function resolveSelector(backlog: Backlog, selector: string): Selection {
  if (selector === 'all') {
    // allTasks: every task in the tree, already sorted by order then id — re-sorted here because the
    // filter is what decides the batch's running order and it must not depend on the reader's sort.
    //
    // `failed` is skipped exactly as `done` is, and this is the ONE place that skip lives: an
    // unattended batch must not spend the night re-failing last night's tasks. It is deliberately not
    // a taskSkipReason — that predicate also guards `/run <id>`, which stays the deliberate retry
    // ("I fixed the spec, try again") and needs no flag to say so.
    const ids = allTasks(backlog)
      .filter((t) => t.status !== 'done' && t.status !== 'failed')
      .sort((a, b) => a.order - b.order)
      .map((t) => t.id);
    return { ids, isBatch: true };
  }
  if (selector === 'next') {
    // nextRunnableTasks: pending tasks whose every dependency is done, in `order`.
    const next = nextRunnableTasks(backlog)[0];
    return { ids: next ? [next.id] : [], isBatch: false };
  }
  const ids = selector.split(',').map((s) => s.trim()).filter((s) => s !== '');
  return { ids, isBatch: ids.length > 1 };
}
