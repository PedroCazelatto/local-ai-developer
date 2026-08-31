// The vocabulary core/session speaks — every type no single function in the folder owns.
//
// The constitution's rule: a type lives in the file that owns the function it describes, and a type
// no function owns lives in the folder's `types.ts`. "No function owns it" is not a judgement call to
// agonise over — when several peer functions all produce or consume a shape and none of them is
// plainly its author (a create/switch pair, a save/pop/drop trio, a diff/log/show trio), that is
// itself the signal, and the shape belongs here. `review-types.ts` was a second spelling of this same
// file and has been merged in; `types.ts` is the one mandated spelling per folder.

// ---------------------------------------------------------------------------------- task backlog
// The backlog is a tree of Markdown files under <projectRoot>/backlog/ (COMMITTED — a human-browseable
// plan + progress trail): up to three levels — an epic folder, a story folder, and a task file — where
// ONLY task files are required. A task may sit directly in backlog/, or under an epic, or under an
// epic + story. Each epic/story folder MAY hold a README.md documenting that level; every other .md is
// a task carrying YAML frontmatter (status/order/depends_on) plus a Markdown body (the definition +
// acceptance the Worker is seeded with).
//
// The PATH is the identity: a task's id is its path relative to backlog/ without the ".md" extension,
// e.g. "epic-auth/story-signup/01-add-hashing-test". depends_on entries are these same ids. Statuses
// flip in each file's frontmatter as execution runs; PRODUCT_SPEC.md stays the narrative.
// (Supersedes the earlier single .orchestrator/backlog.json decision.)

/** pending -> in_progress -> done, plus blocked. In V1, `done` is user-gated (no auto-Reviewer). */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done', 'blocked'];

export interface Task {
  /** Stable id = path under backlog/ without ".md", e.g. "epic-auth/story-signup/01-hash-test". */
  readonly id: string;
  /** Absolute host path to the task's .md file. */
  readonly filePath: string;
  /** Title: the body's first H1, else the humanized file slug. */
  readonly title: string;
  /** Full Markdown body after the frontmatter — the definition + acceptance the Worker is seeded with. */
  readonly body: string;
  /** Task ids (backlog-relative paths) that must be `done` before this is eligible; [] if none. */
  readonly dependsOn: readonly string[];
  /** Global execution-sequence index across the whole backlog (frontmatter `order`). */
  readonly order: number;
  readonly status: TaskStatus;
  /** Owning epic slug (top folder under backlog/), or null when the task isn't under an epic. */
  readonly epic: string | null;
  /** Owning story slug (second folder), or null when the task isn't under a story. */
  readonly story: string | null;
}

export interface Backlog {
  /** Every task in the tree, sorted by `order` then `id`. */
  readonly tasks: readonly Task[];
}

// --------------------------------------------------------------------------------- review verdict
// Review verdict types (V2/01) — the ONLY contract between a spawned Reviewer window and its
// consumers (V2/02 review integration + the REPL renderer). A Reviewer judges ONE Worker attempt
// and emits exactly one ReviewVerdict; downstream keys off this parsed, validated shape — never off
// free text. They live here, in the folder's vocabulary file, so the runner that produces a verdict
// and the interface that renders one share one definition without either importing the other.

/** blocker/major on a verdict force result "fail"; a "minor" may accompany a "pass". */
export type Severity = 'blocker' | 'major' | 'minor';

export const SEVERITIES: readonly Severity[] = ['blocker', 'major', 'minor'];

export interface ReviewIssue {
  /** blocker/major ⇒ the verdict must be "fail"; minor may ride along on a pass. */
  readonly severity: Severity;
  /** Project-relative path, e.g. "src/foo.ts"; "" when the issue isn't file-specific. */
  readonly file: string;
  /** Concrete + actionable: what is wrong and the fix direction (never a vague "looks off"). */
  readonly note: string;
}

export interface ReviewVerdict {
  readonly result: 'pass' | 'fail';
  /** 1–3 sentences: the overall judgment. Always non-empty. */
  readonly summary: string;
  /** Empty when a "pass" carries no findings; ≥1 when "fail". Never a blocker/major on a pass. */
  readonly issues: readonly ReviewIssue[];
}

/**
 * The user's call after seeing a verdict (V2/02): commit + mark done, hand back for a manual Worker
 * fix (leave uncommitted), or move on (leave uncommitted). Only "accept" ever triggers the commit.
 */
export type ReviewDecision = 'accept' | 'sendBack' | 'skip';

// ------------------------------------------------------------------------------- model-facing git
// Outcome shapes shared by peer git operations, each set authored by no one of them: create/switch
// both build a BranchResult, save/pop/drop all build a ShelfResult, and diff/log/show all build an
// InspectResult. The shapes a single function does own stay with it — BranchList with listBranches,
// Shelf with listShelves, PushResult with pushCurrentBranch, GitRun with runGit.

/** The outcome of a create / switch. `error` is set exactly when `ok` is false. */
export interface BranchResult {
  readonly ok: boolean;
  /** The branch now checked out (on success), or the one that was asked for (on failure). */
  readonly branch: string;
  /**
   * True when `create` found the branch already there and switched to it instead. The caller reports
   * this back so a re-run reads as "resumed", never as "created twice".
   */
  readonly existed: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}

/** The outcome of a save / pop / drop. `error` is set exactly when `ok` is false. */
export interface ShelfResult {
  readonly ok: boolean;
  /** The label acted on. */
  readonly label: string;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}

/** The outcome of a read-only diff / log / show. Every one of them is bounded. */
export interface InspectResult {
  readonly ok: boolean;
  /** The bounded output. "" when there is nothing to show (a clean diff, an empty log). */
  readonly output: string;
  /** True when the output was cut to fit the budget — the model is told, never left guessing. */
  readonly truncated: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}
