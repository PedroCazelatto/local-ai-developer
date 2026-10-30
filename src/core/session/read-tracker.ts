// The per-window read tracker — "has this window seen this file, and does the file still say what it
// saw?". Backs the look-before-you-write guard that edit_file and write_file run (tools/guard-write-target.ts).
//
// SCOPE IS THE WINDOW, and that is the whole design. Every runner that owns a `callTool` owns exactly
// one of these (orchestrator per master phase, worker-runner, reviewer-runner, retro-runner, and one
// per sub-agent), so a sub-agent's reads can never satisfy its parent's guard — the parent never saw
// what the sub-agent read, which is the case the guard exists to catch.
//
// The master phases empty it when `/clear` or `/resume` swaps the context out: the tracker follows the
// PHASE CONTEXT, not the process. A cleared context no longer holds the read in its history, so the
// model can no longer see the file, and a guard that still honoured that read would be answering for a
// window that no longer exists. Swapping phases does NOT empty it — `/swap` changes which phase is
// active, not which context that phase is on.
//
// The Worker's tracker deliberately survives all five review rounds. Its reads stay valid for as long
// as the bytes do, and the staleness half is what covers the gap: the Reviewer drives git between
// rounds, so "the file changed under you" is a real state there, and it is caught by content rather
// than by expiry.

import { hashBytes } from '../../tools/hash-bytes.js';
import type { FileReadStatus } from './file-read-status.type.js';
import type { FileReadTracker } from './file-read-tracker.type.js';

/**
 * Build an empty tracker for one window. Keyed by the path string the model used, which is the same
 * project-root-relative string every file tool takes — `resolve`/`scopeToWorkspace` have already
 * refused anything that is not one by the time a path reaches here.
 */
export function createReadTracker(): FileReadTracker {
  const seen = new Map<string, string>();

  return {
    record(path: string, bytes: Uint8Array): void {
      seen.set(path, hashBytes(bytes));
    },

    status(path: string, current: Uint8Array): FileReadStatus {
      const read = seen.get(path);
      if (read === undefined) return 'unread';
      return read === hashBytes(current) ? 'current' : 'stale';
    },

    clear(): void {
      seen.clear();
    },
  };
}
