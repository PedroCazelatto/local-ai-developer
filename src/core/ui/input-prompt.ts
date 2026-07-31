// The REPL's input marker, in one place.
//
// Three things must agree on this exact string or the terminal drifts: readline echoes it at the live
// prompt, the input-box erase measures it to find the row it left the cursor on (renderer.ts), and both
// the type-ahead row (input-fence-row.ts) and the committed gray message block (user-message-bars.ts)
// reproduce it. It lives on its own so every one of them can read it without importing the others.

/** The REPL input prompt. */
export const INPUT_PROMPT = '› ';
