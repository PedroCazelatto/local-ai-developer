// The status bar's state, in a module of its own because one function per file put the functions that
// read and write it into thirteen separate files, and an ESM binding cannot be reassigned across a
// module boundary — so the state has to be a mutable object rather than a set of `let`s.
//
// THE RULES, which the language does not enforce and which are therefore written down:
//   - this object IS mutable, deliberately;
//   - only status-bar.ts's own functions may write it;
//   - nothing outside that family may import this file at all — callers go through the statusBar
//     object, which is the whole reason it exists.
// The encapsulation a module-private `let` gave for free is now a convention, and a convention nobody
// wrote down is one nobody keeps.

export const statusBarState = {
  /** True only between enable() and disable() on a real TTY. Guards setters/disable() against no-ops. */
  active: false,
  /** Last status lines handed to setStatus(), repainted after a resize so they survive reflow. */
  statusLine1: '',
  statusLine2: '',
  /** The styled type-ahead row while a turn runs; null when idle — and it is what picks the row count. */
  fenceRow: null as string | null,
  /** Bound resize listener, kept so disable() can remove exactly the one enable() added. */
  onResize: null as (() => void) | null,
};
