// Write the orchestrator-global app state (V5/02). Single-process, single-writer (no parallelism —
// CLAUDE.md), so the load-merge-write below is race-free; the temp-then-rename keeps a kill mid-write
// from leaving a torn state.json the next boot cannot parse.

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

import { appStateDir } from './app-state-dir.js';
import { appStateFile } from './app-state-file.js';
import type { AppState } from './app-state.type.js';
import { loadAppState } from './load-app-state.js';

/**
 * Persist a partial update, MERGED over the current on-disk state so unrelated (future) fields survive.
 * Creates ~/.local-ai-developer on first write. Writes to a temp file then renames (atomic on the same
 * filesystem) so a crash mid-write can never leave a half-written, unparseable state.json. Throws on an
 * I/O failure — the caller (`/models use`) keeps the in-session switch and just warns it won't persist.
 */
export function saveAppState(partial: Partial<AppState>): void {
  // appStateDir: ~/.local-ai-developer, resolved via os.homedir().
  const dir = appStateDir();
  mkdirSync(dir, { recursive: true });
  // loadAppState: the current on-disk state, or {} when missing or unparseable.
  const merged: AppState = { ...loadAppState(), ...partial };
  const file = appStateFile();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`);
  renameSync(tmp, file);
}
