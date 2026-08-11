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
import type { BatchFile } from './list-batch-files.type.js';

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
