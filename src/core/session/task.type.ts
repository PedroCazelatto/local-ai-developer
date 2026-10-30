// One task, as read from its .md file under backlog/. The PATH is the identity: the id is the file's
// path relative to backlog/ without the ".md" extension, e.g.
// "epic-auth/story-signup/01-add-hashing-test", and depends_on entries are these same ids.

import type { TaskStatus } from './task-status.type.js';

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
