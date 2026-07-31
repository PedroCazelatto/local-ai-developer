// Types for capture-type-ahead.ts (constitution: types live in a sibling file, never inline).
//
// The keypress protocol and the injectable input source are declared once, beside the other function
// that takes stdin as a dependency rather than reaching for it (bind-newline-key.ts), and re-exported
// here so this function's types still resolve from its own sibling.

export type { KeypressListener, KeypressSource } from './bind-newline-key.type.js';
