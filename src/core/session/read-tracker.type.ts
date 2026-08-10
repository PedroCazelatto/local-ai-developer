// Types for the per-window read tracker (read-tracker.ts). The ToolContext depends on the INTERFACE,
// not the factory, so a window can hand its tools any implementation that answers these three
// questions — and so src/tools/ never imports session internals.

/**
 * What the window knows about a path, at the moment a write tool is about to change it.
 *
 * - `unread` — this window never read the file. The model is about to change something it has not seen.
 * - `stale`  — it read the file, but the bytes on disk are no longer the bytes it read.
 * - `current`— it read the file and the file still says what it said. The only status that may write.
 *
 * The two failures carry DIFFERENT instructions ("read it first" vs "read it again"), which is why
 * they are distinct states rather than one boolean — a model handed the wrong one loops.
 */
export type FileReadStatus = 'unread' | 'stale' | 'current';

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
