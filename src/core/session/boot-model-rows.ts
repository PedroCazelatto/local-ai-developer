// The boot chooser's reference table: one plain row per INSTALLED model, with its one marker.
//
// Why every model is listed and not just the selectable ones (OPEN-QUESTIONS.md #14, #78): the list is
// where "why was that one skipped?" gets asked, so hiding a toolless model would make the chooser's
// own omissions invisible. It is shown, marked, and — because the prompt beside it only ever offers the
// tool-capable rows — never selectable.
//
// Plain text, no theme: the caller paints whole rows, and a pure string list is what the terminal-grid
// replay and the unit tests can both hold still. The marker comes from modelMarker, shared with
// `/models list`, so neither the wording nor the precedence between the two markers can drift between
// the two surfaces.

import type { InstalledModel } from '../llm/list-models.js';
import { formatSize } from '../ui/format-size.js';
import { modelMarker } from '../ui/model-marker.js';
import { probeCacheKey } from './probe-cache-key.js';
import type { ProbeCache } from './probe-cache.type.js';

/**
 * One row per model: `  <name padded>   <size right-aligned>   [marker]`. Names are padded to the
 * widest name so the size column lines up; the marker is absent, not blank, on a model with nothing to
 * say, so no row carries trailing whitespace. Empty in, empty out — the caller decides what an empty
 * machine says.
 *
 * `probes` is the VRAM measurement cache and `numCtx` this session's ceiling; together they decide the
 * `(too heavy)` half of the marker. An empty cache is a valid input and simply marks nothing.
 */
export function bootModelRows(
  installed: readonly InstalledModel[],
  probes: ProbeCache,
  numCtx: number,
): readonly string[] {
  // The `0` is belt-and-braces rather than load-bearing, and mutation testing is what established
  // that: removing it survives every test, because `.map` below never runs on an empty list and so
  // nothing ever reads the -Infinity `Math.max()` would return. It stays because a width that is a
  // width is worth more than a line saved.
  const nameWidth = Math.max(0, ...installed.map((m) => m.name.length));
  return installed.map((m) => {
    // formatSize: bytes to a human-readable string.
    const size = formatSize(m.size).padStart(9);
    const row = `  ${m.name.padEnd(nameWidth)}   ${size}`;
    // probeCacheKey: `<digest>@<numCtx>`. modelMarker: one note per row — `(no tools)` outranks
    // `(too heavy)`, and an unmeasured model gets nothing.
    const marker = modelMarker(m.capabilities, probes[probeCacheKey(m.digest, numCtx)]);
    return marker === '' ? row : `${row}   ${marker}`;
  });
}
