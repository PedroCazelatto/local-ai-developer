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
// Two keys are deliberately NOT ours:
//   - Ctrl+C is forwarded to the suspended listeners, so it still reaches readline and still ends the
//     session mid-turn. Swallowing the one escape hatch from a long turn would be a bad trade.
//   - Enter is ignored, not submitted (see backlog/queue-messages-while-thinking.md — queueing a
//     message mid-turn is its own task). Editing is deliberately just backspace here: the full
//     buffer, with history and multi-line composition, is readline's job and resumes at the prompt.

import type { KeypressListener, KeypressSource } from './capture-type-ahead.type.js';

/** C0 controls + DEL. Stripped from a keystroke so a pasted newline can never enter the buffer. */
const CONTROL = /[\x00-\x1f\x7f]/g;

/**
 * Route keystrokes on `input` into a type-ahead buffer seeded with `initial`, calling `onChange` with
 * the buffer after every edit. Returns stop(): it detaches, restores the listeners it suspended, and
 * returns the final buffer.
 */
export function captureTypeAhead(
  input: KeypressSource,
  initial: string,
  onChange: (text: string) => void,
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
    if (key?.name === 'backspace') {
      const glyphs = [...text]; // by code point: one backspace deletes one glyph, not half a pair
      glyphs.pop();
      text = glyphs.join('');
      onChange(text);
      return;
    }
    if (key?.ctrl === true || key?.meta === true) return; // shortcuts belong to nobody here
    if (str === undefined || str === '') return;
    if (str.startsWith('\x1b')) return; // an escape sequence (arrows, delete, F-keys) is never text
    const printable = str.replace(CONTROL, ''); // Enter/Tab/Esc reduce to nothing and are dropped
    if (printable === '') return;
    text += printable;
    onChange(text);
  };

  input.on('keypress', onKey);

  return () => {
    input.off('keypress', onKey);
    for (const listener of suspended) input.on('keypress', listener);
    return text;
  };
}
