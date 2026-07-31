// Take stdin for the duration of a model turn so what the user types goes into the fenced input row
// instead of into the terminal.
//
// The problem this fixes is not cosmetic. readline keeps line-editing the whole time — even with no
// `rl.question` pending — so a key pressed mid-turn is ECHOED wherever the cursor happens to be
// (straight through the streamed reply) and the finished line is emitted as a `line` event that
// nobody is listening for, so the text is silently dropped. Verified against real readline before
// this file existed: 16 characters typed with no question pending produced 16 echo writes and one
// unheard `line` event.
//
// So we snapshot every keypress listener and detach it, exactly as ask-questions.ts and
// confirm-key.ts do for their widgets, and hold that for the length of the turn. Nothing echoes,
// nothing reaches readline's buffer, and the caller renders the text where it belongs. stop()
// restores precisely what was found and hands back the buffer for the next prompt.
//
// The keymap while a turn runs:
//   - printable keys and backspace build the buffer;
//   - Enter hands a non-empty buffer to onSubmit (the REPL queues it) and clears the row;
//   - ↑ asks for the last submitted message back and puts it in the row to edit;
//   - Shift+Enter is ignored: the row is one line, and a message being composed across lines belongs
//     at the real prompt where readline can edit it properly;
//   - Ctrl+C is forwarded to the suspended listeners, so it still reaches readline and still ends the
//     session mid-turn. Swallowing the one escape hatch from a long turn would be a bad trade.
//
// Editing is deliberately just backspace: the full buffer, with history and multi-line composition, is
// readline's job and resumes the moment the prompt reopens.

import { isNewlineKey } from './is-newline-key.js';
import type { KeypressListener, KeypressSource, TypeAheadHandlers } from './capture-type-ahead.type.js';

/** C0 controls + DEL. Stripped from a keystroke so a pasted newline can never enter the buffer. */
const CONTROL = /[\x00-\x1f\x7f]/g;

/**
 * Route keystrokes on `input` into a type-ahead buffer seeded with `initial`, reporting every edit to
 * `handlers`. Returns stop(): it detaches, restores the listeners it suspended, and returns whatever is
 * left in the buffer (what was typed but not submitted).
 */
export function captureTypeAhead(
  input: KeypressSource,
  initial: string,
  handlers: TypeAheadHandlers,
): () => string {
  const suspended = input.listeners('keypress') as KeypressListener[];
  for (const listener of suspended) input.off('keypress', listener);

  let text = initial;

  const onKey: KeypressListener = (str, key) => {
    // Ctrl+C: hand it back untouched so readline raises SIGINT and the session ends, as it does today.
    if (key?.ctrl === true && key.name === 'c') {
      for (const listener of suspended) listener(str, key);
      return;
    }
    // ↑ before the escape-sequence guard below, which would otherwise swallow it as `\x1b[A`.
    if (key?.name === 'up') {
      const recalled = handlers.onRecall();
      if (recalled === null) return; // nothing queued: the row keeps whatever is in it
      text = recalled;
      handlers.onChange(text);
      return;
    }
    // isNewlineKey: Shift+Enter / Alt+Enter, which compose a line break at the prompt. Claimed here
    // ONLY to stop the `return`/`enter` check below reading them as a submit.
    if (isNewlineKey(key)) return;
    if (key?.name === 'return') {
      if (text.trim() === '') return; // an empty submit queues nothing
      handlers.onSubmit(text);
      text = '';
      handlers.onChange(text);
      return;
    }
    if (key?.name === 'backspace') {
      const glyphs = [...text]; // by code point: one backspace deletes one glyph, not half a pair
      glyphs.pop();
      text = glyphs.join('');
      handlers.onChange(text);
      return;
    }
    if (key?.ctrl === true || key?.meta === true) return; // shortcuts belong to nobody here
    if (str === undefined || str === '') return;
    if (str.startsWith('\x1b')) return; // an escape sequence (arrows, delete, F-keys) is never text
    const printable = str.replace(CONTROL, ''); // Enter/Tab/Esc reduce to nothing and are dropped
    if (printable === '') return;
    text += printable;
    handlers.onChange(text);
  };

  input.on('keypress', onKey);

  return () => {
    input.off('keypress', onKey);
    for (const listener of suspended) input.on('keypress', listener);
    return text;
  };
}
