// Persistent-REPL renderer: append-only print helpers. THE whole point of the rewrite is
// preserving scrollback (the old Rich Live(screen=True) TUI grabbed the alt-buffer and the user
// couldn't copy/paste from it — see the "verify via scripted live checks" memory). So: never use
// the alt-buffer, and never repaint HISTORY — anything that has scrolled is immutable, so the user
// can scroll up and copy freely. The one-time clearScreen() at boot wipes launcher noise; the pinned
// rows are owned by status-bar.ts via a scroll region, not by clearing or redrawing here.
//
// Live output is the one nuance (constitution, Terminal UX): assistantStream rewrites the line it is
// CURRENTLY streaming — still under the cursor, not yet history — to render its markdown once the
// line completes. Every line it leaves behind is final. Transient widgets (ask-questions.ts, the
// spinner) may likewise repaint their own frame, then must collapse into one static, copyable summary.
//
// Keep this module dumb (pure printing). Turn-loop logic, tool dispatch, and history live in the
// orchestrator (task 06); the UI only displays and collects input.
//
// An ASSEMBLER: one function per file put the ten operations and one private helper in eleven files,
// and this composes the public ten into the single object callers already used it as. It exports that
// object and nothing else — INPUT_PROMPT used to ride along here as a second exported value and no
// longer does; its one outside reader (repl.ts) imports input-prompt.ts directly. The live stream
// lives in renderer-state.ts, which only this family may write.

import { assistantStream } from './assistant-stream.js';
import { blankLine } from './blank-line.js';
import { clearScreen } from './clear-screen.js';
import { commitUserMessage } from './commit-user-message.js';
import { discardInput } from './discard-input.js';
import { errorLine } from './error-line.js';
import { inputRuleTop } from './input-rule-top.js';
import { interjectLine } from './interject-line.js';
import { printUserMessage } from './print-user-message.js';
import { systemMessage } from './system-message.js';

/** The append-only print surface: open a turn's stream, print through it, collapse the input box. */
export const renderer = {
  clearScreen,
  assistantStream,
  interjectLine,
  blankLine,
  inputRuleTop,
  commitUserMessage,
  printUserMessage,
  discardInput,
  systemMessage,
  errorLine,
};
