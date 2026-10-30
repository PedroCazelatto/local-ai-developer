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
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// show-batch.ts picks the file and re-prints it, over list-batch-files.ts,
// read-batch-summary-file.ts and describe-available-batches.ts.

import type { Command } from '../command.type.js';
import { showBatch } from './show-batch.js';

export const batchCommand: Command = {
  name: 'batch',
  group: 'execution',
  description: 'Re-print a persisted batch summary (the most recent, or the batch number you name)',
  usage: '/batch [<batch number>]',
  // showBatch: the named batch (or the most recent), re-printed through the same renderer the live
  // end-of-batch summary uses; a number that is not on disk answers with the range that is.
  run: (ctx) => showBatch(ctx.args, ctx.orch),
};
