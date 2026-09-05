// The fenced input box that stays on screen while a turn runs: rule, `›` row, rule — the last of
// those three being the pinned rule the status bar already owns. A small state machine over three
// collaborators: capture-type-ahead.ts takes the keystrokes, status-bar.ts owns the reserved rows they
// are painted on, and input-fence-row.ts formats the row itself.
//
// The turn loop brackets every model turn with begin/end, and that call is REENTRANT: a sub-agent
// runs its own processMessage inside a tool call of the turn that spawned it, so the inner end() must
// not tear the fence down while the outer turn is still going. Hence the depth count — the fence goes
// up on the first begin and comes down on the last end.
//
// The buffer OUTLIVES a single turn on purpose. A `/run` task loop is many turns with gaps between
// them, and text typed during the Worker must still be there when the Reviewer's turn ends; the REPL
// drains it into the next real prompt, where readline takes over with full editing.
//
// TWO things submitted here do NOT join the queue, and both are injected by the REPL rather than decided
// in this layer (which knows about rows and keystrokes, not about sessions):
//   - Ctrl+C, offered to the cancel handler (offer-fence-cancel.ts). It stops the model call in flight;
//     declining hands the key back to readline, which ends the session as it always did.
//   - a control line such as `/stop`, offered to the control handler (submit-fence-line.ts). Queueing one
//     would be useless — the queue drains only when the whole `/run` finishes, which is precisely the
//     thing being asked to stop.
// Both default to "not handled" when no handler is registered, so off a REPL the fence behaves as before.
//
// An ASSEMBLER: one function per file put the five operations and their four private collaborators in
// nine files, and this composes the public five into the single object callers already used it as. It
// exports that object and nothing else. The state lives in input-fence-state.ts, which only this
// family may write.

import { beginInputFence } from './begin-input-fence.js';
import { drainTypedAhead } from './drain-typed-ahead.js';
import { endInputFence } from './end-input-fence.js';
import { resetInputFence } from './reset-input-fence.js';
import { setFenceHandlers } from './set-fence-handlers.js';

/** The fenced input row that survives a turn: wire it, raise it, drop it, and drain what was typed. */
export const inputFence = {
  setHandlers: setFenceHandlers,
  begin: beginInputFence,
  end: endInputFence,
  drain: drainTypedAhead,
  reset: resetInputFence,
};
