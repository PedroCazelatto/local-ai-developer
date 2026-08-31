// Replay the blocker store. Open-vs-resolved is DERIVED from these rows, never mutated in place: a
// `raised` row with no matching `resolved` row (by id) is open.

import { existsSync, readFileSync } from 'node:fs';

import { blockersFile } from './blockers-file.js';
import { isBlockerRow } from './is-blocker-row.js';
import type { BlockerRow } from './types.js';

/** Read + parse every row; a malformed line is skipped (a torn last line must not sink replay). */
export function readBlockerRows(projectPath: string): BlockerRow[] {
  // blockersFile: <projectPath>/.orchestrator/blockers.jsonl.
  const file = blockersFile(projectPath);
  if (!existsSync(file)) return [];
  const rows: BlockerRow[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      // isBlockerRow: drops a row that does not match its own `kind`.
      if (isBlockerRow(parsed)) rows.push(parsed);
    } catch {
      // A partial/torn line (e.g. a kill mid-write) — skip it, keep replaying the intact rows.
    }
  }
  return rows;
}
