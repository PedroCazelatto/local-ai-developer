// The one spelling of the "this model's weights will not fit in VRAM" marker.
//
// It sits beside no-tools-marker.ts and appears in the same two surfaces — `/models list` and the boot
// chooser — but it means the OPPOSITE KIND OF THING, and the contrast is the point (#96a). A toolless
// model is refused: it cannot run a phase at all. A too-heavy model is only MARKED: it runs, it is
// slow, and docs/product.md's line is that *slow is a choice the user gets to make; incapable is not*.
//
// Weights on the CPU means every token of every layer crosses the bus, which is why this is worth a
// marker at all when a KV-cache spill is not. The verdict behind it is weights-resident.ts.

/** Shown beside a model whose weights did not all fit in VRAM, in `/models list` and the boot chooser. */
export const TOO_HEAVY_MARKER = '(too heavy)';
