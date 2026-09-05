// Read the orchestrator-global app state (V5/02). Boot MUST never crash over this file: a missing one
// is normal (fresh install), and a corrupt one falls back to defaults with a surfaced warning.

import { existsSync, readFileSync } from 'node:fs';

import { appStateFile } from './app-state-file.js';
import type { AppState } from './app-state.type.js';
import { narrowAppState } from './narrow-app-state.js';

/**
 * Load the global app state. A missing file is normal (fresh install) → `{}` silently. A corrupt file
 * (unparseable / not an object) is surfaced with a console.warn and treated as `{}` so the caller falls
 * back to its defaults — boot never crashes over it (task 02: "never crash boot over it"). console.warn
 * matches the other boot fallbacks behind config (resolveNumCtx / resolveRatio).
 */
export function loadAppState(): AppState {
  // appStateFile: ~/.local-ai-developer/state.json.
  const file = appStateFile();
  if (!existsSync(file)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
    // narrowAppState: drops any field of the wrong type — the file is hand-editable.
    return narrowAppState(parsed);
  } catch {
    console.warn(`Warning: could not parse ${file}; ignoring it and using defaults.`);
    return {};
  }
}
