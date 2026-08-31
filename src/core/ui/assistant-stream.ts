// Open the output sink for ONE streamed assistant turn: deltas in, markdown on screen.
//
// The reply carries NO phase-name prefix — which phase is active is shown by the pinned status line,
// so the response text starts at the margin (empty prefix; see create-markdown-stream.ts).
//
// Call once per turn, on the FIRST visible delta, so a pure tool-call turn prints no empty header.
//
// The three arrows below are NOT declarations under the sweep's bar and are left exactly as they were:
// an object literal built inside a function body and returned is a closure-based handle, and its
// arrows are this function's implementation, the same as a local. Only a literal at module top level
// is the dodge the arrow-property rule closed.

import { createMarkdownStream } from './create-markdown-stream.js';
import { rendererState } from './renderer-state.js';
import type { MarkdownStream } from './types.js';

/** Open the output sink for one streamed assistant turn. */
export function assistantStream(): MarkdownStream {
  // createMarkdownStream: raw deltas printed live, each line repainted formatted once it completes.
  const stream = createMarkdownStream('');
  // Held so interjectLine can print THROUGH a reply in flight. Released by end(), which the turn loop
  // always calls — including on a turn that produced no prose at all. The wrapper exists only for that
  // release: everything else forwards straight through.
  rendererState.live = stream;
  return {
    push: (delta) => stream.push(delta),
    end: () => {
      stream.end();
      rendererState.live = null;
    },
    interject: (block) => stream.interject(block),
  };
}
