// Next sequential batch number: one past the highest already on disk, so numbering survives a restart
// and a summary file is never overwritten.
//
// Named nextBatchSeq rather than the module-private `nextSeq` it was extracted from -- `nextSeq` is
// also the name of PhaseState's turn counter (fresh-phase-state.ts), and two unrelated `nextSeq`s in
// one folder is a reader's trap even though only one of them is a declaration.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { BATCHES_DIRNAME } from './batches-dirname.js';

/** Next sequential batch number: one past the highest `<n>-` prefix already in .orchestrator/batches/. */
export function nextBatchSeq(projectPath: string): number {
  const dir = path.join(projectPath, '.orchestrator', BATCHES_DIRNAME);
  if (!existsSync(dir)) return 1;
  let max = 0;
  for (const name of readdirSync(dir)) {
    const prefix = /^(\d+)-/.exec(name);
    if (prefix) max = Math.max(max, Number(prefix[1]));
  }
  return max + 1;
}
