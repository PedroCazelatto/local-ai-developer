// Read a task's global execution-sequence index. Three sources in priority order, so a backlog stays
// ordered even when the model forgets the field: the frontmatter `order`, then a leading number in
// the filename (the convention the Breakdown phase is told to follow), then last.

import path from 'node:path';

/** frontmatter `order`, else a leading number in the filename (`01-foo` -> 1), else last (∞). */
export function readOrder(raw: unknown, filePath: string): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
  const prefix = /^(\d+)/.exec(path.basename(filePath));
  return prefix ? Number(prefix[1]) : Number.MAX_SAFE_INTEGER;
}
