// Narrow a stored role to the closed MemoryRole union. An unknown value cannot reach here — the
// `messages.role` CHECK constraint rejects it — but a hand-edited database must not throw on read.

import type { SQLOutputValue } from 'node:sqlite';

import type { MemoryRole } from './memory-role.type.js';
import { sqlText } from './sql-text.js';

/** Narrow the stored role; an unknown value cannot reach here (CHECK constraint) but must not throw. */
export function sqlMemoryRole(value: SQLOutputValue | undefined): MemoryRole {
  // sqlText: the column as a string, or '' when absent/non-text.
  const role = sqlText(value);
  return role === 'assistant' || role === 'tool' || role === 'summary' ? role : 'user';
}
