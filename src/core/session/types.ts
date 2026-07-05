// Task-backlog types (V1/09). The ordered Epic -> Story -> Task hierarchy the planning phases write
// (as .orchestrator/backlog.json, via the model's write_file tool) and the execution trigger +
// Worker consume. This resolves CLAUDE.md's open "task backlog format/location" question.
//
// backlog.json is gitignored SESSION STATE (statuses flip as execution runs); the committed
// narrative is PRODUCT_SPEC.md. IDs are stable once assigned (E1 / E1-S1 / E1-S1-T1) — the audit,
// statuses, and Worker seeding all key off them.

/** pending -> in_progress -> done, plus blocked. In V1, `done` is user-gated (no auto-Reviewer). */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done', 'blocked'];

export interface Task {
  /** Stable id `<storyId>-T<n>`, e.g. "E1-S1-T1". */
  readonly id: string;
  readonly title: string;
  /** Full definition the Worker is seeded with: what to build, constraints. */
  readonly description: string;
  /** Observable signal of done, e.g. "npm test passes the hashing spec". */
  readonly acceptance: string;
  /** Task ids that must be `done` before this is eligible; [] if none. */
  readonly depends_on: readonly string[];
  /** Global execution-sequence index across the whole backlog. */
  readonly order: number;
  readonly status: TaskStatus;
}

export interface Story {
  readonly id: string; // `<epicId>-S<n>`, e.g. "E1-S1"
  readonly title: string;
  readonly tasks: readonly Task[];
}

export interface Epic {
  readonly id: string; // `E<n>`, e.g. "E1"
  readonly title: string;
  readonly stories: readonly Story[];
}

export interface Backlog {
  readonly version: number;
  readonly epics: readonly Epic[];
}
