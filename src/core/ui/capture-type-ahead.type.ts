// Types for capture-type-ahead.ts (constitution: types live in a sibling file, never inline).
//
// The keypress protocol and the injectable input source are declared once, beside the other function
// that takes stdin as a dependency rather than reaching for it (bind-newline-key.ts), and re-exported
// here so this function's types still resolve from its own sibling.

export type { KeypressListener, KeypressSource } from './bind-newline-key.type.js';

/** What the capture does with the keys it claims. The buffer itself stays inside the capture. */
export interface TypeAheadHandlers {
  /** The buffer changed (a character, a backspace, a recall) — repaint the row. */
  onChange(text: string): void;
  /** Enter on a non-empty buffer: the message is the caller's now, and the buffer is cleared. */
  onSubmit(text: string): void;
  /** ↑: the caller returns a message to put back in the buffer, or null when it has none. */
  onRecall(): string | null;
  /**
   * Ctrl+C mid-turn. Return true to CLAIM the press as a cancel (the turn stops, the session lives);
   * return false to decline it, and the key falls through to readline exactly as it always did and ends
   * the session. Declining is what keeps the escape hatch honest: a press that cannot cancel anything —
   * nothing is generating, or the turn was already cancelled and is still unwinding — must still quit.
   */
  onCancel(): boolean;
}
