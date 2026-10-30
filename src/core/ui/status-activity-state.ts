// Live activity state for the transient activity line, in a module of its own because one function
// per file put the functions that read and write it into seven separate files, and an ESM binding
// cannot be reassigned across a module boundary — so the state has to be a mutable object rather than
// a set of `let`s.
//
// THE RULES, which the language does not enforce and which are therefore written down:
//   - this object IS mutable, deliberately;
//   - only status-activity.ts's own functions may write it;
//   - nothing outside that family may import this file at all — callers go through the statusActivity
//     object, which is the whole reason it exists.
// The encapsulation a module-private `let` gave for free is now a convention, and a convention nobody
// wrote down is one nobody keeps.
//
// These are UI-only display values. The constitution forbids them feeding any VRAM-safety or
// summarization decision — that is the exact Ollama token count's job, never a wall-clock timer.

export const statusActivityState = {
  /** The tool currently executing, or null when none is (between turns, or while the model streams). */
  currentTool: null as string | null,
  /** Epoch ms when the current tool started — the elapsed timer counts up from here. */
  toolStartedAt: 0,
  /** True while a model turn is in flight — gates the `thinking` field. */
  turnActive: false,
  /** Epoch ms when the current turn started — the thinking timer counts up from here. */
  turnStartedAt: 0,
};
