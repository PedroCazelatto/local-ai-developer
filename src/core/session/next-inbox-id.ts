// The project-global inbox id counter. Named nextInboxId rather than the module-private `nextId` it
// was extracted from, which says nothing standing alone in a flat folder.

import { PHASES } from './inbox-phases.js';
import { readInboxEvents } from './read-inbox-events.js';

/**
 * Next project-global inbox id: 1 + the total number of `post` events across EVERY recipient file.
 * Posts are append-only and never deleted, so the count is monotonic → the id is unique across all
 * files and sortable. No parallelism (CLAUDE.md), so count-then-append is race-free. (A sequential
 * number was substituted for a ULID by the user's decision.)
 */
export function nextInboxId(projectPath: string): string {
  let posts = 0;
  for (const phase of PHASES) {
    // readInboxEvents: one recipient's intact events, torn lines skipped.
    posts += readInboxEvents(projectPath, phase).filter((event) => event.kind === 'post').length;
  }
  return String(posts + 1);
}
