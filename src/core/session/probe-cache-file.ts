// ~/.local-ai-developer/vram-probes.json — the probe cache's own file, deliberately NOT state.json.
//
// ITS OWN FILE IS THE WHOLE POINT (OPEN-QUESTIONS.md #103): deleting it is the reset gesture, and it
// has to be safe to delete at any moment because nothing in this repo can detect a driver upgrade or a
// swapped GPU. Every measurement in it was true of the machine as it was; if the machine changes, the
// user removes one file and the next boot re-measures. Folding these rows into state.json would have
// made that gesture destroy the user's model choice along with them.
//
// It sits BESIDE state.json in the home directory for the same reason state.json is there: what it
// records is a property of the MACHINE — how much this card can hold — not of whichever project is
// open. Two projects on one box share the answer.

import path from 'node:path';

import { appStateDir } from './app-state-dir.js';

/** ~/.local-ai-developer/vram-probes.json — safe to delete at any time; the next boot re-measures. */
export function probeCacheFile(): string {
  // appStateDir: ~/.local-ai-developer, resolved via os.homedir().
  return path.join(appStateDir(), 'vram-probes.json');
}
