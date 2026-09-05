// The active phase's inbox. The model never names itself — the caller passes the session's active
// phase, so there is no drift-prone phase argument on the tool for a model to get wrong.

import { foldInboxItems } from './fold-inbox-items.js';
import { readInboxEvents } from './read-inbox-events.js';
import type { InboxItem, InboxReadStatus, Phase } from './types.js';

/**
 * The active phase's inbox: replay only ITS file (posts addressed to it live there) and filter by
 * status. `open` (default) drops resolved items; `all` returns the full history. The model never names
 * itself — the caller passes the session's active phase (no drift-prone phase argument on the tool).
 */
export function readInbox(projectPath: string, activePhase: Phase, status: InboxReadStatus): InboxItem[] {
  // readInboxEvents + foldInboxItems: replay this recipient's file, then overlay resolves onto posts.
  const items = foldInboxItems(readInboxEvents(projectPath, activePhase));
  return status === 'open' ? items.filter((item) => !item.resolved) : items;
}
