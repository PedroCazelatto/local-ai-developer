// Tab candidates for /answer. Split out of answer.ts.

import { allTasks, readBacklog } from '../../core/session/index.js';
import type { CompletionContext } from '../completion-context.type.js';

/**
 * Tab candidates for `/answer <task-id>`: ONLY tasks sitting at `blocked`, which is exactly the set this
 * command can act on — an id with no open blocker is rejected by dispatchAnswer, so offering more would
 * just invite that error. Everything past the id is free-text answer prose.
 */
export function completeAnswer(ctx: CompletionContext): string[] {
  if (ctx.args.length > 0) return [];
  try {
    // readBacklog is a SYNC file read — safe inside a completer that must never await (complete-line.ts).
    // No backlog (or an unreadable one) simply means no ids to offer, never a thrown Tab.
    return allTasks(readBacklog(ctx.orch.projectPath))
      .filter((t) => t.status === 'blocked')
      .map((t) => t.id);
  } catch {
    return [];
  }
}
