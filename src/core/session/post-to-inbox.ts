// Post a cross-phase message (V3/04). The event goes to the RECIPIENT's file, which is what lets a
// phase read its inbox by replaying one file rather than all six.

import { appendJsonlLine } from './append-jsonl-line.js';
import { inboxFile } from './inbox-file.js';
import { nextInboxId } from './next-inbox-id.js';
import type { InboxItem, Phase } from './types.js';

/**
 * Post a message from `from` to `to`: assign the next global id, stamp UTC now, append a `post` event
 * to the RECIPIENT's file, and return the created item. The caller validates `to`/`body` first.
 */
export function postToInbox(projectPath: string, from: Phase, to: Phase, body: string): InboxItem {
  const item: InboxItem = {
    // nextInboxId: 1 + every `post` across every recipient file — project-global and monotonic.
    id: nextInboxId(projectPath),
    from,
    to,
    created: new Date().toISOString(),
    body,
    resolved: false,
  };
  // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
  appendJsonlLine(inboxFile(projectPath, to), { kind: 'post', id: item.id, from, to, created: item.created, body });
  return item;
}
