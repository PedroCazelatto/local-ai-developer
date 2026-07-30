// Shapes for the MODEL-FACING stash (project-git-stash.ts). A shelf is addressed by the label the
// model chose, never by a `stash@{n}` index — an index shifts the moment anything else is stashed,
// and the task loop stashes on its own schedule.

/** One `lad-shelf:` stash, as the model sees it. Task-loop stashes never appear here. */
export interface Shelf {
  /** The model's own label, with the `lad-shelf:` prefix stripped. */
  readonly label: string;
  /** The branch the work was stashed from. */
  readonly branch: string;
  /** Relative age, e.g. "2 hours ago" — enough to tell a stale shelf from a fresh one. */
  readonly when: string;
}

/** The outcome of a save / pop / drop. `error` is set exactly when `ok` is false. */
export interface ShelfResult {
  readonly ok: boolean;
  /** The label acted on. */
  readonly label: string;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}
