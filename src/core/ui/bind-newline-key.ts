// Give the newline key (Shift+Enter) to the input buffer instead of to readline's submit.
//
// The obstacle: readline parses a bare LF as `enter` and SUBMITS on it, exactly as it does for CR. A
// plain `stdin.on('keypress')` listener cannot prevent that — every listener on an EventEmitter runs,
// and readline's was attached first, so by the time ours is called the line has already been sent.
//
// So we take readline's listener off the stream, put ours in front, and hand every key we do not claim
// straight back to it. This is the same suspend-and-restore move ask-questions.ts makes for the
// duration of its widget, just held for the life of the REPL. Re-dispatching the captured LISTENER
// (rather than reaching for readline's internals) keeps its own surrogate-pair handling intact.
//
// Leaving exactly one keypress listener behind also matters: ask-questions.ts and confirm-key.ts
// snapshot `stdin.listeners('keypress')` to mute readline while they own the terminal, and what they
// snapshot is now this wrapper — so muting it mutes the newline key with it, which is what the
// question panel wants (it reads keys itself).

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import { insertNewline } from './insert-newline.js';
import { isNewlineKey } from './is-newline-key.js';
import type { KeypressListener, KeypressSource } from './types.js';

/**
 * Route the newline key on `input` into `rl`'s edit buffer. Returns the undo: it detaches the wrapper
 * and puts readline's own listener back, so a closing REPL leaves the stream as it found it.
 *
 * A no-op off a TTY, where readline runs in non-terminal mode and emits no keypress events at all —
 * there is no listener to capture and nothing to intercept.
 */
export function bindNewlineKey(rl: ReadlineInterface, input: KeypressSource): () => void {
  // readline's own onkeypress, installed by createInterface. Captured whole: it calls _ttyWrite AND
  // refreshes the line for a surrogate-pair half, and we must not drop the second half of that job.
  const readlineListeners = input.listeners('keypress') as KeypressListener[];
  if (readlineListeners.length === 0) return () => undefined;

  const wrapper: KeypressListener = (str, key) => {
    // isNewlineKey: true for Shift+Enter (bare LF) and Alt+Enter (ESC CR) — never for plain Enter.
    if (isNewlineKey(key)) {
      insertNewline(rl); // splice `\n` in at the cursor and repaint via rl.prompt(true)
      return;
    }
    for (const listener of readlineListeners) listener(str, key);
  };

  for (const listener of readlineListeners) input.off('keypress', listener);
  input.on('keypress', wrapper);

  return () => {
    input.off('keypress', wrapper);
    for (const listener of readlineListeners) input.on('keypress', listener);
  };
}
