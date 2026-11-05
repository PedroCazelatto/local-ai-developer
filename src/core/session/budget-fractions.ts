// Every model-facing budget as a FRACTION of the one ceiling, OLLAMA_NUM_CTX (backlog item 7, meta F:
// "lets unify all constants to just one, the maximum context available"). This file is the table; the
// arithmetic is budget-tokens.ts. Retuning a budget is one edit here and nowhere else — that is the whole
// point of the file, so a budget written as a literal at its call site is a regression.
//
// Each fraction was chosen to PRESERVE the budget its constant had before it was derived (#99a: "use this
// proposal and we adjust later in testing"), not to retune it, so at the default 16 384 every row lands
// close to its old character cap at four characters a token. A numerator over a denominator rather than a
// decimal, because 1/12, 1/14 and 1/28 have no exact float and Math.floor of an inexact product can land
// one under.
//
// What is deliberately NOT here: round counts and line or entry caps bound effort and readability, not
// window space, and stay as they are (#93c); `DIFF_MAX_CHARS` and `OUTPUT_PREVIEW_LIMIT` bound what a
// PERSON reads and stay in characters (#99a); and execute_command / run_in_project's output caps are still
// characters, pending backlog item 42.

export const BUDGET_FRACTIONS = {
  /**
   * The `num_ctx` the bounded one-shots — the context titler, `search_rules`, the commit-message writer —
   * are sent under (resolve-window-ctx.ts). Half the base: 8 192 at 16 384, the value it held as a
   * residency measurement before it was derived. A real ceiling, not an estimate.
   */
  boundedOneShotNumCtx: { numerator: 1, denominator: 2 },
  /**
   * Every host-side git read: the Reviewer's diff (capture-changed-files.ts), the commit-message writer's
   * pathspec diff (diff-paths.ts), Retro's read of a failed attempt (read-task-stash-diff.ts), and the
   * three git_inspect reads (inspect-diff.ts / inspect-log.ts / inspect-show.ts). 3 072 at 16 384.
   */
  reviewDiff: { numerator: 3, denominator: 16 },
  /** The transcript handed to the context titler (build-title-transcript.ts). 1 365 at 16 384. */
  titleTranscript: { numerator: 1, denominator: 12 },
  /** One read_file result (render-numbered-slice.ts). 1 170 at 16 384. */
  readFile: { numerator: 1, denominator: 14 },
  /** The Worker's last run_in_project result, carried to the Reviewer (worker-window.ts). 1 024 at 16 384. */
  testRunCapture: { numerator: 1, denominator: 16 },
  /** Each document in the Worker's spec slice (build-spec-slice.ts). 585 at 16 384. */
  specSlice: { numerator: 1, denominator: 28 },
} as const;
