// One VRAM probe result — the two byte counts a residency verdict is derived from, and the row shape
// the probe cache stores (~/.local-ai-developer/vram-probes.json).
//
// It gets its own file because no function owns it: probeModelVram builds one from the daemon,
// narrowProbeCache builds one from the cache file, and weightsResident only reads them — so it is the
// vocabulary two directories share rather than one function's result (constitution.md, "A type no
// function owns gets its own file", which names a stored row shape as the example).
//
// WHY THE MEASUREMENT IS STORED AND NOT THE VERDICT. The verdict is a pure function of these two
// numbers (weights-resident.ts), and the cache never invalidates — so baking a boolean in would freeze
// today's arithmetic into a file that can only ever be corrected by deleting it. These bytes are what
// was actually observed; the verdict is re-derived on every read, and a sharper formula would apply
// itself to every row already on disk. It costs one extra number per row.

/** The two byte counts one probe measured: what the weights weigh, and what stayed in VRAM. */
export interface VramMeasurement {
  /**
   * The model's ON-DISK size in bytes, from `/api/tags` — i.e. what its weights weigh. Carried in the
   * row rather than looked up beside it so the pair can never be mismatched: a row states which
   * weights met which VRAM figure.
   */
  readonly weightsBytes: number;
  /**
   * `size_vram` from `/api/ps` while the model was loaded — the bytes Ollama actually placed on the
   * GPU. NOT the loaded total: `/api/ps`'s `size` also counts what spilled to system RAM, so
   * `size - size_vram` is the spill and says nothing on its own about whether the WEIGHTS spilled.
   */
  readonly sizeVramBytes: number;
}
