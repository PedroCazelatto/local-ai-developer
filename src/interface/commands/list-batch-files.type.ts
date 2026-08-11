// Types for list-batch-files.ts / read-batch-summary-file.ts (constitution: types live in a sibling
// file, never inline). A batch summary is persisted by the batch driver as pretty JSON under
// .orchestrator/batches/, named `<zero-padded seq>-<compact startedAt>.json` — written that way
// precisely so the morning-after report survives the REPL. These types are what a listing needs to
// address one of those files by the number the report itself printed (`Batch #7`).

/** One persisted batch summary on disk, addressed by the seq its own report prints as `Batch #N`. */
export interface BatchFile {
  /** Sequential batch number, parsed from the file name's zero-padded prefix. */
  readonly seq: number;
  /** File name as written, e.g. `0007-20260711T030405Z.json`. */
  readonly fileName: string;
  /** Absolute host path to the file. */
  readonly filePath: string;
}
