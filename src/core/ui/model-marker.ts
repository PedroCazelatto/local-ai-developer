// The marker column of a model row: ONE note per row, and which note it is.
//
// THE COMPOSITION DECISION, AND IT WAS MEASURED RATHER THAN CHOSEN BY TASTE. Two markers now exist —
// `(no tools)` (refuses) and `(too heavy)` (marks) — and a model can carry both grounds at once: on the
// box this was built for, codestral:22b reports no `tools` AND leaves ~1.9 GB of weights on the CPU. So
// something had to decide what a row says when both apply.
//
// Appending both, in the three-space style the first marker already uses, does not fit. `/models list`
// on this machine is 56 columns before the marker column — 2 + `●` + 1 + a 21-char name + 3 + a 9-char
// size + 3 + a 16-char timestamp — and the two markers cost 3 + 10 + 3 + 11 = 27 more, for a row of 83.
// That wraps an 80-column terminal, which is the same trap that forced `/models list`'s toolless legend
// from 95 characters down to 68. Closing the gap to one space still gives 81. One marker gives at most
// 70, with ten columns to spare for a longer model name than this box has.
//
// So: ONE marker column, with a fixed precedence — `(no tools)` outranks `(too heavy)`. The reason is
// the product line the two markers exist to draw (docs/product.md): *slow is a choice the user gets to
// make; incapable is not.* On a model the user cannot select at all, "it would also be slow" informs no
// decision, because there is no decision to inform. The refusal is the note that matters, and it is
// the one the row shows.
//
// The consequence, stated so it is not discovered later as a bug: a toolless model's measurement is
// never rendered anywhere. That is what makes probing the toolless models pure cost — see the note in
// pending-probes.ts, which measures them anyway because the task file specifies it.

import { supportsTools } from '../llm/supports-tools.js';
import type { VramMeasurement } from '../llm/vram-measurement.type.js';
import { weightsResident } from '../llm/weights-resident.js';
import { NO_TOOLS_MARKER } from './no-tools-marker.js';
import { TOO_HEAVY_MARKER } from './too-heavy-marker.js';

/**
 * The marker for one model row, or `''` when there is nothing to say. `capabilities` is what
 * `/api/tags` reported (`[]` reads as incapable — the fail-closed gate); `measurement` is the probe
 * cache's row for this model at this session's num_ctx, or undefined when nothing has been measured.
 *
 * UNMEASURED IS NOT TOO HEAVY. An absent measurement yields no marker, because a marker is a claim
 * about the machine and there is nothing to claim — the opposite direction from the capability gate,
 * which fails closed precisely because it can refuse and this cannot.
 */
export function modelMarker(
  capabilities: readonly string[],
  measurement: VramMeasurement | undefined,
): string {
  // supportsTools: `tools` in what /api/tags reported. Checked FIRST — see the precedence above.
  if (!supportsTools(capabilities)) return NO_TOOLS_MARKER;
  if (measurement === undefined) return '';
  // weightsResident: the on-disk weights fit inside the size_vram the daemon actually gave the model.
  return weightsResident(measurement) ? '' : TOO_HEAVY_MARKER;
}
