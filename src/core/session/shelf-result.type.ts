// The outcome of a model-facing shelf save, pop or drop. All three build one and none authors it.

/** The outcome of a save / pop / drop. `error` is set exactly when `ok` is false. */
export interface ShelfResult {
  readonly ok: boolean;
  /** The label acted on. */
  readonly label: string;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}
