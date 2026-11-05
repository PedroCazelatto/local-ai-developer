// The single append-only JSONL writer shared by the .orchestrator/ stores that are still files — the
// blocker, question and inbox logs. Identical durability for all of them: create the parent dir on
// first write, open in append mode, write ONE line, and fsync before closing so a kill mid-write leaves
// at most a torn LAST line — never a corrupted earlier row.
//
// It was written for the tool-audit and events logs, which moved into memory.db tables in backlog item
// 19; it survives because these stores still need it. The caller owns the row's SHAPE, this owns
// getting it onto disk intact.

import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from 'node:fs';
import path from 'node:path';

/** Append one JSON object as a line to `filePath`, creating its directory and fsync-ing before close. */
export function appendJsonlLine(filePath: string, row: Record<string, unknown>): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const line = `${JSON.stringify(row)}\n`;
  const fd = openSync(filePath, 'a');
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
