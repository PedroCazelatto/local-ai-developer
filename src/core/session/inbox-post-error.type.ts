// Why an inbox_post was rejected -- structured and recoverable, so the model reads it and retries.

/** Why an `inbox_post` was rejected (structured, recoverable — the model reads it and retries). */
export type InboxPostError = 'unknown_to_phase' | 'empty_body';
