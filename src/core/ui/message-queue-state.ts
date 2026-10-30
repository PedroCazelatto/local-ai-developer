// The message queue's state, in a module of its own because one function per file put the functions
// that read and write it into six separate files, and an ESM binding cannot be reassigned across a
// module boundary — so the state has to be a mutable object rather than a set of `let`s.
//
// THE RULES, which the language does not enforce and which are therefore written down:
//   - this object IS mutable, deliberately;
//   - only message-queue.ts's own functions may write it;
//   - nothing outside that family may import this file at all — callers go through the messageQueue
//     object, which is the whole reason it exists.
// The encapsulation a module-private `let` gave for free is now a convention, and a convention nobody
// wrote down is one nobody keeps.

/** Messages submitted mid-turn, oldest first. */
export const messageQueueState = {
  queued: [] as string[],
};
