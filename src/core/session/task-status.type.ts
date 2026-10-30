// The task lifecycle. A closed union: pending -> in_progress -> done, plus the two ways a task ends
// without being done -- blocked (a question only the user can answer) and failed (five rounds tried,
// none passed). In V1 `done` is user-gated -- there is no automatic Reviewer promotion.
//
// `failed` is a TERMINAL record, not a queue: it exists so an attempted task stops looking untouched.
// `/run all` skips it (resolve-selector.ts) while `/run <id>` still retries it from scratch, which is
// the whole point of spending a status on it rather than reverting to `pending`.

/** pending -> in_progress -> done, plus blocked and failed. In V1, `done` is user-gated (no auto-Reviewer). */
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked' | 'failed';
