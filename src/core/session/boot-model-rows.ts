// The boot chooser's reference table: one plain row per INSTALLED model, toolless ones marked.
//
// Why every model is listed and not just the selectable ones (OPEN-QUESTIONS.md #14, #78): the list is
// where "why was that one skipped?" gets asked, so hiding a toolless model would make the chooser's
// own omissions invisible. It is shown, marked, and — because the prompt beside it only ever offers the
// tool-capable rows — never selectable.
//
// Plain text, no theme: the caller paints whole rows, and a pure string list is what the terminal-grid
// replay and the unit tests can both hold still. The `(no tools)` wording is NO_TOOLS_MARKER, shared
// with `/models list` so the two surfaces cannot drift into saying the same thing two ways.

import type { InstalledModel } from '../llm/list-models.js';
import { supportsTools } from '../llm/supports-tools.js';
import { formatSize } from '../ui/format-size.js';
import { NO_TOOLS_MARKER } from '../ui/no-tools-marker.js';

/**
 * One row per model: `  <name padded>   <size right-aligned>   [(no tools)]`. Names are padded to the
 * widest name so the size column lines up; the marker is absent, not blank, on a capable model, so no
 * row carries trailing whitespace. Empty in, empty out — the caller decides what an empty machine says.
 */
export function bootModelRows(installed: readonly InstalledModel[]): readonly string[] {
  // The `0` is belt-and-braces rather than load-bearing, and mutation testing is what established
  // that: removing it survives every test, because `.map` below never runs on an empty list and so
  // nothing ever reads the -Infinity `Math.max()` would return. It stays because a width that is a
  // width is worth more than a line saved.
  const nameWidth = Math.max(0, ...installed.map((m) => m.name.length));
  return installed.map((m) => {
    // formatSize: bytes to a human-readable string. supportsTools: the `tools` capability, [] fails.
    const size = formatSize(m.size).padStart(9);
    const row = `  ${m.name.padEnd(nameWidth)}   ${size}`;
    return supportsTools(m.capabilities) ? row : `${row}   ${NO_TOOLS_MARKER}`;
  });
}
