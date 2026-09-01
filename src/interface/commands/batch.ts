// /batch [n] — re-print a persisted batch summary: `/batch 3` is the report headed "Batch #3", and a
// bare /batch is the most recent one.
//
// The morning-after report is the entire point of the product's core loop — start a batch, walk away,
// come back to a report — and it was already being written to .orchestrator/batches/ as pretty JSON
// PRECISELY so it would survive the REPL. Nothing read it back, so coming back meant quitting the app
// and opening the file. This is the read half.
//
// The number is the batch's own seq: it is what the report prints as `Batch #N`, and what the file is
// named by, so the number the user saw is the number they type. Asking for one that is not there
// answers the follow-up question in the same line by naming the range that IS on disk — which is why
// there is no /batch list to learn first.
//
// It re-prints through renderBatchSummary, the SAME renderer the live end-of-batch summary uses, so a
// re-read report and the one printed the night it ran can never drift apart.

import { renderer } from '../../core/ui/renderer.js';
import { renderBatchSummary } from '../render-batch-summary.js';
import type { Command } from '../command-registry.js';
import { listBatchFiles } from './list-batch-files.js';
import type { BatchFile } from './list-batch-files.type.js';
import { readBatchSummaryFile } from './read-batch-summary-file.js';

/** The slice of the orchestrator /batch needs — satisfied structurally by SessionOrchestrator. */
export interface BatchOrchestrator {
  readonly projectPath: string;
}

const USAGE = 'Usage: /batch [<batch number>] — the most recent batch when the number is left off';

/** `#4` for one file, `#1–#7` for a range — what to name when the asked-for batch is not on disk. */
function describeAvailable(files: readonly BatchFile[]): string {
  const first = files[0];
  const last = files[files.length - 1];
  if (first === undefined || last === undefined) return 'none';
  return first.seq === last.seq ? `#${first.seq}` : `#${first.seq}–#${last.seq}`;
}

function showBatch(args: readonly string[], orch: BatchOrchestrator): void {
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
      renderer.errorLine(`No batch #${seq} — batches ${describeAvailable(files)} are on disk.`);
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

export const batchCommand: Command = {
  name: 'batch',
  group: 'execution',
  description: 'Re-print a persisted batch summary (the most recent, or the batch number you name)',
  usage: '/batch [<batch number>]',
  run: (ctx) => showBatch(ctx.args, ctx.orch),
};
