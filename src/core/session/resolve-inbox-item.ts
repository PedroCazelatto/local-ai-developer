// Resolve an inbox item on behalf of whichever phase is acting. `by` (the resolver) is recorded
// distinctly from the original `to`, so ANY phase may resolve an item it did not receive — which is
// why finding the item means scanning the closed set of recipient files rather than just its own.

import { appendJsonlLine } from './append-jsonl-line.js';
import { foldInboxItems } from './fold-inbox-items.js';
import { inboxFile } from './inbox-file.js';
import { PHASES } from './inbox-phases.js';
import { readInboxEvents } from './read-inbox-events.js';
import type { InboxResolveResult, Phase } from './types.js';

/**
 * Resolve item `id` on behalf of `resolver`: locate the RECIPIENT file that holds it (an item lives in
 * the file named after its `to` phase — scan the closed set), reject unknown/already-resolved, else
 * append a `resolve` event to that same file. `by` (the resolver) is recorded distinctly from the
 * original `to`, so any phase may resolve an item it did not receive.
 */
export function resolveInboxItem(
  projectPath: string,
  resolver: Phase,
  id: string,
  note: string,
): InboxResolveResult {
  for (const phase of PHASES) {
    // readInboxEvents + foldInboxItems: replay this recipient's file, then overlay resolves onto posts.
    const item = foldInboxItems(readInboxEvents(projectPath, phase)).find((candidate) => candidate.id === id);
    if (item === undefined) continue;
    if (item.resolved) {
      return { ok: false, error: 'already_resolved', message: `inbox item '${id}' is already resolved` };
    }
    // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
    appendJsonlLine(inboxFile(projectPath, phase), { kind: 'resolve', id, by: resolver, resolved: new Date().toISOString(), note });
    return { ok: true, id };
  }
  return { ok: false, error: 'unknown_id', message: `no inbox item with id '${id}'` };
}
