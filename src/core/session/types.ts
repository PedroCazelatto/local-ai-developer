// Task-backlog types. The backlog is a tree of Markdown files under <projectRoot>/backlog/
// (COMMITTED — a human-browseable plan + progress trail): up to three levels — an epic folder, a
// story folder, and a task file — where ONLY task files are required. A task may sit directly in
// backlog/, or under an epic, or under an epic + story. Each epic/story folder MAY hold a README.md
// documenting that level; every other .md is a task carrying YAML frontmatter (status/order/
// depends_on) plus a Markdown body (the definition + acceptance the Worker is seeded with).
//
// The PATH is the identity: a task's id is its path relative to backlog/ without the ".md"
// extension, e.g. "epic-auth/story-signup/01-add-hashing-test". depends_on entries are these same
// ids. Statuses flip in each file's frontmatter as execution runs; PRODUCT_SPEC.md stays the
// narrative. (Supersedes the earlier single .orchestrator/backlog.json decision.)

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
