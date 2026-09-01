// Every persisted batch summary in a project, ascending by seq — the index /batch addresses a report
// by. A pure directory read: the batch driver already writes one pretty-JSON file per batch under
// .orchestrator/batches/, and until now nothing read them back.
//
// The seq comes from the FILE NAME's zero-padded prefix rather than from the file's contents, so a
// listing costs one readdir instead of parsing every summary in the folder — and a corrupt file still
// appears in the index (with the right number) instead of vanishing from it.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { BATCHES_DIRNAME } from '../../core/session/index.js';

/**
 * One persisted batch summary on disk, addressed by the seq its own report prints as `Batch #N`. A
 * batch summary is written by the batch driver as pretty JSON under .orchestrator/batches/, named
 * `<zero-padded seq>-<compact startedAt>.json` — written that way precisely so the morning-after
 * report survives the REPL, and this is what a listing needs to address one of those files by the
 * number the report itself printed (`Batch #7`).
 */
export interface BatchFile {
  /** Sequential batch number, parsed from the file name's zero-padded prefix. */
  readonly seq: number;
  /** File name as written, e.g. `0007-20260711T030405Z.json`. */
  readonly fileName: string;
  /** Absolute host path to the file. */
  readonly filePath: string;
}

/**
 * The project's persisted batch summaries, ascending by seq. An empty array covers both "no batch has
 * ever run here" (no folder) and "the folder holds nothing a batch wrote" — the caller degrades to one
 * recoverable line either way, so the two need no separate signal.
 */
export function listBatchFiles(projectPath: string): BatchFile[] {
  const dir = path.join(projectPath, '.orchestrator', BATCHES_DIRNAME);
  if (!existsSync(dir)) return [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return []; // an unreadable folder reports as "no batches" — one recoverable line, never a throw
  }
  const files: BatchFile[] = [];
  for (const fileName of names) {
    // `<zero-padded seq>-<compact startedAt>.json` — anything else in the folder is not ours to read.
    const prefix = /^(\d+)-.*\.json$/i.exec(fileName);
    if (prefix === null) continue;
    files.push({ seq: Number(prefix[1]), fileName, filePath: path.join(dir, fileName) });
  }
  return files.sort((a, b) => a.seq - b.seq);
}
