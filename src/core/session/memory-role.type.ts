// The role of one stored turn in a phase context. A closed union, mirrored by a CHECK constraint on
// `messages.role`, so an unknown role is rejected by the database rather than stored and puzzled over.

/**
 * The role of a stored turn. `user | assistant | tool` are the live conversation; `summary` is written
 * by the summarization failsafe to collapse older turns. Mirrored by a CHECK constraint on
 * `messages.role`, so an unknown role is rejected by the database rather than stored and puzzled over.
 */
export type MemoryRole = 'user' | 'assistant' | 'tool' | 'summary';
