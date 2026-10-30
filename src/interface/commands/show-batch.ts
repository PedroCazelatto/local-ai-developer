// The body of /batch: pick a persisted batch summary off disk and re-print it. Split out of batch.ts,
// which is now the assembler that registers it.
//
// It re-prints through renderBatchSummary, the SAME renderer the live end-of-batch summary uses, so a
// re-read report and the one printed the night it ran can never drift apart.

import { renderer } from '../../core/ui/renderer.js';
import { renderBatchSummary } from '../render-batch-summary.js';
import { describeAvailableBatches } from './describe-available-batches.js';
import { listBatchFiles } from './list-batch-files.js';
import type { BatchFile } from './list-batch-files.js';
import { readBatchSummaryFile } from './read-batch-summary-file.js';

/** The slice of the orchestrator /batch needs — satisfied structurally by SessionOrchestrator. */
export interface BatchOrchestrator {
  readonly projectPath: string;
}

const USAGE = 'Usage: /batch [<batch number>] — the most recent batch when the number is left off';

/** Re-print the batch summary `args[0]` names, or the most recent one when the number is left off. */
export function showBatch(args: readonly string[], orch: BatchOrchestrator): void {
  // listBatchFiles: every persisted summary, ascending by the seq in its file name.
  const files = listBatchFiles(orch.projectPath);
  if (files.length === 0) {
    renderer.systemMessage('No batches have run in this project yet — /run all (or a comma list of ids) starts one.');
    return;
  }

  const asked = (args[0] ?? '').trim();
  let file: BatchFile | undefined;
  if (asked === '') {
    file = files[files.length - 1]; // bare /batch — the most recent
  } else {
    const seq = Number(asked);
    if (!Number.isInteger(seq) || seq < 1) {
      renderer.errorLine(`'${asked}' is not a batch number. ${USAGE}`);
      return;
    }
    file = files.find((candidate) => candidate.seq === seq);
    if (file === undefined) {
      // describeAvailableBatches: `#4`, or `#1–#7` for a range — the numbers that ARE on disk.
      renderer.errorLine(`No batch #${seq} — batches ${describeAvailableBatches(files)} are on disk.`);
      return;
    }
  }
  if (file === undefined) return; // unreachable (files is non-empty), guarded defensively

  // readBatchSummaryFile: parse + narrow the persisted JSON back to a real BatchSummary, or null.
  const summary = readBatchSummaryFile(file.filePath);
  if (summary === null) {
    renderer.errorLine(
      `Batch #${file.seq} is on disk but could not be read (.orchestrator/batches/${file.fileName}) — ` +
        'it is not a batch summary this build can render.',
    );
    return;
  }
  // renderBatchSummary: the counts table, then the escalated/blocked/stopped queues the user must act
  // on, then the EXACT token total and where the report is saved.
  renderBatchSummary(summary);
}
