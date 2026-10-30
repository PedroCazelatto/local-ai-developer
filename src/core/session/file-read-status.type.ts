// What a window knows about a path — one unowned type, in its own file. It is the return type of
// FileReadTracker.status, a method on an INTERFACE, so there is no function file to fold it into
// however few files name it: ask what would own it, not how many import it. createReadTracker returns
// a FileReadTracker, not a FileReadStatus, and the `status` member that does produce one is built
// inside that function's body.

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
