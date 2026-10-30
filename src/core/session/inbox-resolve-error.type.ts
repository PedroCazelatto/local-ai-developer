// Why an inbox_resolve was rejected -- structured and recoverable, never a thrown error.

/** Why an `inbox_resolve` was rejected (structured, recoverable). */
export type InboxResolveError = 'unknown_id' | 'already_resolved';
