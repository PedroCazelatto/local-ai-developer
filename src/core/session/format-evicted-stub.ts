// The one line that stands where an evicted tool result used to be — the model-facing half of eviction.
//
// WHY IT IS WORDED THIS WAY. The way to stop a Worker re-reading an evicted file is not to forbid it,
// it is to REMOVE THE REASON. A model that has to guess what happened to its own history guesses by
// reading, so the stub answers the four questions that would otherwise send it back to the file:
//
//   1. it happened      — naming the call keeps the window's earlier reasoning coherent, so the Worker
//                         does not conclude it imagined the read;
//   2. the text is gone — from THIS WINDOW, said plainly, so a blank is never read as a tool failure;
//   3. nothing broke    — the file on disk is untouched and the look-before-you-write guard still holds
//                         it, so an edit does NOT need a fresh read (read-tracker.ts keeps the record
//                         eviction does not touch — see docs/mental-model.md);
//   4. when to re-read  — a narrow, honest condition, because the stub must not lie: read_file still
//                         works, and a stub that pretended otherwise would be found out on the next call.
//
// Clause 3 is why the read_file wording says "unchanged and still editable" rather than something
// shorter. It is the clause that does the real work, and it applies only to a path — which is why the
// other tools get the parallel sentence and not that one.
//
// The stub never claims the result is unrecoverable, and never says "superseded": nothing here knows
// that a newer call replaced this one. It says only that the text is no longer being carried.

import { toolCallSubject } from '../ui/tool-call-subject.js';

/**
 * The stub for one evicted tool result.
 *
 * toolCallSubject: the ONE argument that names what a call did — the path, the command, the search
 * pattern — chosen per tool and already stripped of anything that could move a cursor. Reused rather
 * than re-derived so the stub names a call exactly as the scrollback did, and so a tool that renames a
 * parameter is followed in one place instead of two.
 */
export function formatEvictedStub(toolName: string, args: Record<string, unknown>): string {
  const subject = toolCallSubject(toolName, args);
  const called = subject.text === '' ? toolName : `${toolName} '${subject.text}'`;
  // read_file is the only evictable tool whose subject is a file the window may still be asked to
  // EDIT, so it is the only one that has to say the write guard is unaffected (clause 3 above).
  if (toolName === 'read_file') {
    return (
      `[${called} — text dropped from this window to stay inside the context limit. ` +
      `The file is unchanged and still editable. Re-read only if you need it.]`
    );
  }
  return (
    `[${called} — output dropped from this window to stay inside the context limit. ` +
    `Run it again only if you need it.]`
  );
}
