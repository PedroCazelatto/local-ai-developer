// Give a context its title — what turns it from a filename into an addressable, listable record.

import type { DatabaseSync } from 'node:sqlite';

/** Give a context its title. Called once per context, after its first prose answer. */
export function setContextTitle(db: DatabaseSync, contextId: string, title: string): void {
  db.prepare('UPDATE contexts SET title = ? WHERE id = ?').run(title, contextId);
}
