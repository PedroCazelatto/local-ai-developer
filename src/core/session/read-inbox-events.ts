// Replay one recipient's inbox file. Open-vs-resolved is DERIVED from these events, never mutated in
// place — the discipline that replaced the fragile AGENT_NOTES.md whole-file rewrites.
//
// Named readInboxEvents rather than the module-private `readEvents` it was extracted from: `readEvents`
// says nothing standing alone in a flat folder, and events-log.ts is a different events file entirely.

import { existsSync, readFileSync } from 'node:fs';

import { inboxFile } from './inbox-file.js';
import { isInboxEvent } from './is-inbox-event.js';
import type { InboxEvent, Phase } from './types.js';

/** Read + parse a recipient's events; a malformed line is skipped (a torn last line must not sink replay). */
export function readInboxEvents(projectPath: string, phase: Phase): InboxEvent[] {
  // inboxFile: <projectPath>/.orchestrator/inbox/<phase>.jsonl.
  const file = inboxFile(projectPath, phase);
  if (!existsSync(file)) return [];
  const events: InboxEvent[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      // isInboxEvent: drops an event that does not match its own `kind`.
      if (isInboxEvent(parsed)) events.push(parsed);
    } catch {
      // A partial/torn line (a kill mid-write) — skip it, keep replaying the intact rows.
    }
  }
  return events;
}
