// The single append-only JSONL writer shared by BOTH .orchestrator/ logs: the tool-audit log
// (V1/06) and the orchestrator events log (V5/04). One writer, two files, identical durability:
// create the parent dir on first write, open in append mode, write ONE line, and fsync before
// closing so a kill mid-write leaves at most a torn LAST line — never a corrupted earlier row.
//
// Extracted so audit.ts and events-log.ts do not each re-implement the fsync dance (DRY): the
// caller owns the row's SHAPE, this owns getting it onto disk intact.

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
