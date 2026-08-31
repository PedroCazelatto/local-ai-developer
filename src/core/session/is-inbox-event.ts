// Defensive narrowing for one line of a recipient's inbox file. The file is both hand-inspectable and
// machine-fed, so a row that does not match its own `kind` is dropped rather than trusted.

import type { InboxEvent } from './types.js';

/** Narrow a parsed JSON value to an InboxEvent (defensive — the file is hand-inspectable + machine-fed). */
export function isInboxEvent(value: unknown): value is InboxEvent {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (row['kind'] === 'post') {
    return (
      typeof row['id'] === 'string' &&
      typeof row['from'] === 'string' &&
      typeof row['to'] === 'string' &&
      typeof row['created'] === 'string' &&
      typeof row['body'] === 'string'
    );
  }
  if (row['kind'] === 'resolve') {
    return (
      typeof row['id'] === 'string' &&
      typeof row['by'] === 'string' &&
      typeof row['resolved'] === 'string' &&
      typeof row['note'] === 'string'
    );
  }
  return false;
}
