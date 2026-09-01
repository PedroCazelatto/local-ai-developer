// Defensive narrowing for state.json, which is hand-editable: a field of the wrong type is DROPPED
// rather than trusted or thrown over, so boot never crashes on a file someone edited by hand.

import type { AppState } from './app-state.type.js';

/** Narrow a parsed JSON value to AppState, dropping any field of the wrong type (hand-editable file). */
export function narrowAppState(value: unknown): AppState {
  if (typeof value !== 'object' || value === null) return {};
  const row = value as Record<string, unknown>;
  const state: { activeModel?: string } = {};
  if (typeof row['activeModel'] === 'string' && row['activeModel'].trim() !== '') {
    state.activeModel = row['activeModel'];
  }
  return state;
}
