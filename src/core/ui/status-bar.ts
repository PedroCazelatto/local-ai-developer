// Three pinned rows at the very bottom of the terminal: a full-width RULE, then TWO STATUS lines. They
// are reserved via the DECSTBM scroll region (ESC[top;bottom r) so all normal output — the
// conversation, the prompt, streamed deltas — scrolls in the region ABOVE them and never overwrites
// them. Crucially this is NOT the alt-buffer: the main scrollback stays intact and copyable (the whole
// reason the old Rich Live TUI was abandoned), we just fence off rows.
//
// The RULE row sits directly under the live input, so it reads as the line BELOW the input while the
// user types (its other half — a transient rule ABOVE the input — is printed and erased in
// renderer.ts). During streaming the same rule reads as a divider above the status lines.
//
// While a TURN runs, two MORE rows are reserved above those three — a rule and the type-ahead input
// row — so the input box stays fenced on screen instead of vanishing for the length of the turn
// (input-fence.ts drives it). Reserving them is what makes that cheap: the fence is immune to
// scrolling, so no output path has to know it is there, where a widget drawn in the scroll region
// would have to be erased and redrawn around every single write of the streamed reply.
//
// Callers pass FULLY-STYLED text (chalk already applied): this module paints it verbatim and does NOT
// blanket-dim, so status line 1's color-coded active phase renders in its bright theme color while the
// rest stays dim — the caller composes that mix. The one exception is the rule row, which this module
// generates itself (theme.divider at the current width) since its content is width-derived.
//
// Everything here is a no-op when stdout is not a TTY (piped/redirected runs) — there are no rows to
// pin and the escapes would just corrupt the output.
//
// An ASSEMBLER: one function per file put the seven operations and their six private helpers in
// thirteen files, and this composes the public seven into the single object callers already used it
// as. It exports that object and nothing else. The state lives in status-bar-state.ts and the row
// counts in status-bar-rows.ts; only this family may write the former.

import { disableStatusBar } from './disable-status-bar.js';
import { enableStatusBar } from './enable-status-bar.js';
import { hideInputFence } from './hide-input-fence.js';
import { repaintStatusBar } from './repaint-status-bar.js';
import { setInputFence } from './set-input-fence.js';
import { setStatus } from './set-status.js';
import { showInputFence } from './show-input-fence.js';

/** The pinned bottom rows: take them, paint them, raise and drop the input fence, give them back. */
export const statusBar = {
  enable: enableStatusBar,
  setStatus,
  showInputFence,
  setInputFence,
  hideInputFence,
  repaint: repaintStatusBar,
  disable: disableStatusBar,
};
