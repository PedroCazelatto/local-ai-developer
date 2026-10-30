// Retro is BEST EFFORT. This is what it throws when it produced no usable outcome -- it never edited a
// file, or it edited one and never submitted its diagnosis. A distinct class so the caller can tell
// "the Retro learned nothing" from a real fault and keep the session alive: the user's answer is
// already recorded either way.

/** Retro ended without a usable outcome (never edited a file, or never submitted its diagnosis). */
export class RetroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetroError';
  }
}
