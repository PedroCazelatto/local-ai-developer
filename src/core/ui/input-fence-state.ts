// The input fence's state, in a module of its own because one function per file put the functions that
// read and write it into nine separate files, and an ESM binding cannot be reassigned across a module
// boundary — so the state has to be a mutable object rather than a set of `let`s.
//
// THE RULES, which the language does not enforce and which are therefore written down:
//   - this object IS mutable, deliberately;
//   - only input-fence.ts's own functions may write it;
//   - nothing outside that family may import this file at all — callers go through the inputFence
//     object, which is the whole reason it exists.
// The encapsulation a module-private `let` gave for free is now a convention, and a convention nobody
// wrote down is one nobody keeps.

export const inputFenceState = {
  /** How many begin() calls are outstanding — nested turns share one fence. */
  depth: 0,
  /** The active capture's stop function (restores stdin's listeners, returns the buffer); null when down. */
  stop: null as (() => string) | null,
  /** Text typed while turns ran, waiting for the next prompt to claim it. */
  pending: '',
  /** Registered by the REPL: claims a submitted line as a control instruction instead of queueing it. */
  controlHandler: null as ((line: string) => boolean) | null,
  /** Registered by the REPL: claims Ctrl+C as a cancel; false lets the key end the session as before. */
  cancelHandler: null as (() => boolean) | null,
};
