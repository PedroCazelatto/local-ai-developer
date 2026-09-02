// The renderer's state, in a module of its own because one function per file put the two functions
// that read and write it into two separate files, and an ESM binding cannot be reassigned across a
// module boundary — so the state has to be a mutable object rather than a `let`.
//
// THE RULES, which the language does not enforce and which are therefore written down:
//   - this object IS mutable, deliberately;
//   - only renderer.ts's own functions may write it;
//   - nothing outside that family may import this file at all — callers go through the renderer
//     object, which is the whole reason it exists.
// The encapsulation a module-private `let` gave for free is now a convention, and a convention nobody
// wrote down is one nobody keeps.

import type { MarkdownStream } from './markdown-stream.type.js';

export const rendererState = {
  /** The stream rendering the turn right now, or null between turns — interjectLine prints around it. */
  live: null as MarkdownStream | null,
};
