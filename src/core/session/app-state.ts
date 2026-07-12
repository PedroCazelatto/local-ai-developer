// Orchestrator-global app state (V5/02): a tiny read/write layer over ~/.local-ai-developer/state.json.
// This is HOST-WIDE state (the user's model choice), deliberately NOT under a project's .orchestrator/
// — the model is a hardware choice, agnostic to which project is open (task 02 "State scope"). `~` is
// resolved via os.homedir() (never a literal). Boot MUST never crash over this file: a missing one is
// normal (fresh install), and a corrupt one falls back to defaults with a surfaced warning.
//
// A cohesive store module (like memory-store.ts): two tightly-related functions (load + save) plus
// their helpers over ONE file, not one function per file. Single-process, single-writer (no
// parallelism — CLAUDE.md), so the load-merge-write in saveAppState is race-free; the temp-then-rename
// write keeps a kill mid-write from leaving a torn state.json that the next boot can't parse.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { AppState } from './app-state.type.js';

/** ~/.local-ai-developer — the host-global orchestrator dir (os.homedir() resolves `~`). */
function stateDir(): string {
  return path.join(os.homedir(), '.local-ai-developer');
}

/** The single global state file, ~/.local-ai-developer/state.json. */
function stateFile(): string {
  return path.join(stateDir(), 'state.json');
}

/** Narrow a parsed JSON value to AppState, dropping any field of the wrong type (hand-editable file). */
function narrowAppState(value: unknown): AppState {
  if (typeof value !== 'object' || value === null) return {};
  const row = value as Record<string, unknown>;
  const state: { activeModel?: string } = {};
  if (typeof row['activeModel'] === 'string' && row['activeModel'].trim() !== '') {
    state.activeModel = row['activeModel'];
  }
  return state;
}

/**
 * Load the global app state. A missing file is normal (fresh install) → `{}` silently. A corrupt file
 * (unparseable / not an object) is surfaced with a console.warn and treated as `{}` so the caller falls
 * back to its defaults — boot never crashes over it (task 02: "never crash boot over it"). console.warn
 * matches config.ts's other boot fallbacks (resolveNumCtx / resolveThresholdRatio).
 */
export function loadAppState(): AppState {
  const file = stateFile();
  if (!existsSync(file)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
    return narrowAppState(parsed);
  } catch {
    console.warn(`Warning: could not parse ${file}; ignoring it and using defaults.`);
    return {};
  }
}

/**
 * Persist a partial update, MERGED over the current on-disk state so unrelated (future) fields survive.
 * Creates ~/.local-ai-developer on first write. Writes to a temp file then renames (atomic on the same
 * filesystem) so a crash mid-write can never leave a half-written, unparseable state.json. Throws on an
 * I/O failure — the caller (`/models use`) keeps the in-session switch and just warns it won't persist.
 */
export function saveAppState(partial: Partial<AppState>): void {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  const merged: AppState = { ...loadAppState(), ...partial };
  const file = stateFile();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`);
  renameSync(tmp, file);
}
