// The task lifecycle. A closed union: pending -> in_progress -> done, plus blocked. In V1 `done` is
// user-gated -- there is no automatic Reviewer promotion.

/** pending -> in_progress -> done, plus blocked. In V1, `done` is user-gated (no auto-Reviewer). */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
