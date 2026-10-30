// Where the batch is, for the reporter. UI is injected so the driver stays pure orchestration.

/** Position of a task within the batch's candidate list, for the `task N/M` progress line. */
export interface BatchPosition {
  /** 1-based position among the selected candidate ids. */
  readonly index: number;
  /** Total selected candidate ids (some may end up skipped). */
  readonly total: number;
}
