// The one line /audit and /events add while their table is still empty but the project still has the
// JSONL file the log was kept in before backlog item 19. Those files were deliberately left where they
// are and are no longer read (the user's choice over importing them), so without this line a project
// with months of history would answer "nothing recorded yet" and look as if it had lost it.

import { existsSync } from 'node:fs';
import path from 'node:path';

/** A pointer to the pre-memory.db log at `file`, or null when there is no such file. */
export function legacyLogNote(file: string): string | null {
  if (!existsSync(file)) return null;
  return `Older entries are in .orchestrator/${path.basename(file)}, written before this log moved into memory.db — it is no longer read.`;
}
