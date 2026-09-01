// The outcome of a `/clear`: the phase cleared, and the context it set aside so the command can name
// what `/resume` would reopen.

import type { ContextSummary } from './context-summary.type.js';

/**
 * Outcome of a `/clear`: the phase cleared, and the context it set aside so the command can name what
 * `/resume` would reopen. `cleared` is null when the phase had no persisted context to set aside —
 * a context is only created once the model actually answers, so an untouched phase has none.
 */
export interface ClearResult {
  readonly phase: string;
  readonly cleared: ContextSummary | null;
}
