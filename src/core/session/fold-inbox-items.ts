// Fold a recipient's append-only events into the items a phase actually sees. This is the whole
// open-vs-resolved model: a `post` creates an item, a later `resolve` for the same id overlays it, and
// nothing is ever edited on disk.
//
// Named foldInboxItems rather than the module-private `foldItems` it was extracted from.

import type { InboxEvent } from './inbox-event.type.js';
import type { InboxItem } from './inbox-item.type.js';

/** Fold one recipient's events (posts + resolves) into InboxItems, oldest first (sequential id order). */
export function foldInboxItems(events: InboxEvent[]): InboxItem[] {
  const byId = new Map<string, InboxItem>();
  for (const event of events) {
    if (event.kind === 'post') {
      byId.set(event.id, {
        id: event.id,
        from: event.from,
        to: event.to,
        created: event.created,
        body: event.body,
        resolved: false,
      });
    } else {
      const existing = byId.get(event.id);
      if (existing !== undefined) {
        byId.set(event.id, {
          ...existing,
          resolved: true,
          resolvedAt: event.resolved,
          resolvedBy: event.by,
          note: event.note,
        });
      }
    }
  }
  // Ids are project-global sequential integers → numeric order IS chronological order.
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}
