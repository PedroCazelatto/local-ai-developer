// How many rows are fenced off at the bottom right now: three while idle, five while the input fence
// is up. Every other status-bar function derives its row arithmetic from this one answer.

import { RESERVED_BUSY, RESERVED_IDLE } from './status-bar-rows.js';
import { statusBarState } from './status-bar-state.js';

/** Rows currently fenced off at the bottom: three idle, five while the input fence is up. */
export function reservedRowCount(): number {
  return statusBarState.fenceRow === null ? RESERVED_IDLE : RESERVED_BUSY;
}
