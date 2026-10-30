// The per-window read tracker's INTERFACE — one unowned type, in its own file, and the reason is worth
// stating because a single function does return one. createReadTracker (read-tracker.ts) builds a
// FileReadTracker, which is the shape that folded ChatResult into client.ts and SandboxRead into
// sandbox.ts. It does not fold here, for two reasons that both come from measurement rather than the
// name. EIGHT other files name this type and every one of them CONSUMES it: the orchestrator keeps one
// per master phase, worker-window.ts / reviewer-window.ts / retro-window.ts / subagents.ts each own
// theirs, and tools/guard-write-target.ts takes one as a parameter while tools/create-tool-context.ts
// and tools/tool-context.type.ts carry it on the ToolContext. It is the interface depended UPON, which
// is what lets the write guard be driven with no session at all — the reading that put KeypressSource
// in its own file. And folding it would point src/tools at read-tracker.ts, which imports
// tools/hash-bytes.js: a new edge into the cycle those files' headers already warn about, bought for
// nothing.
//
// The ToolContext therefore depends on this interface and not on the factory, so a window can hand its
// tools any implementation that answers these three questions. What this header used to add — "and so
// src/tools/ never imports session internals" — was FALSE, and had been for as long as it was written:
// about twenty files in src/tools import runtime values out of core/session (commitPaths, inspectDiff,
// postToInbox, runDebate, appendEvent, ...), and tools/registry.ts says outright that the directory
// sits in an import cycle with core/session. What is true, and is the claim worth keeping, is narrower:
// no file in src/tools names read-tracker.ts.

import type { FileReadStatus } from './file-read-status.type.js';

/** What one window remembers about the files it has read. Scoped per window; see read-tracker.ts. */
export interface FileReadTracker {
  /**
   * Remember that the window has seen `path` holding exactly `bytes`. Called on a successful
   * `read_file`, and again by `write_file`/`edit_file` after a write lands — the file the model just
   * wrote IS a file it has seen, and without this its own second edit would come back `stale`.
   */
  record(path: string, bytes: Uint8Array): void;
  /** Compare what the window read against what the file holds now. */
  status(path: string, current: Uint8Array): FileReadStatus;
  /** Drop everything. The master phases call this when `/clear` or `/resume` swaps the context out. */
  clear(): void;
}
