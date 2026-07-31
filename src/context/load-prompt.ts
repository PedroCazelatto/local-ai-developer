// loadPrompt — read one of the orchestrator's own one-shot prompts from rules/prompts/.
//
// A THIRD rules folder, and deliberately not part of the standards catalog: rules/standards/ is the
// on-demand library the model searches with `search_rules` and pulls with `load_rule`, so a file there
// is something the model may choose to read. These files are the other direction — instructions the
// ORCHESTRATOR injects into a throwaway context the model never chooses to enter. Putting one in
// standards/ would offer the model a prompt written to be used on it.
//
// Read FRESH on every call (never cached), matching phase-prompt.ts and standards-catalog.ts: editing a
// prompt takes effect on the next call with no restart.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// rules/prompts/ sits at the orchestrator repo root, resolved relative to THIS file — never to the
// active project (rules are GLOBAL; projects are agnostic to the orchestrator — CLAUDE.md). This file
// is <root>/src/context/load-prompt.ts (tsx) or <root>/dist/context/load-prompt.js (built), both two
// dirs below root, so `../../rules/prompts` resolves to the repo root in either run mode.
export const PROMPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'rules', 'prompts');

/** Typed failure so a caller can tell a missing prompt from any other I/O error and stay recoverable. */
export class PromptNotFoundError extends Error {
  constructor(name: string, cause: unknown) {
    super(`prompt '${name}' could not be read from ${PROMPTS_DIR}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'PromptNotFoundError';
  }
}

/**
 * Return the full text of `rules/prompts/<name>.md`. Throws PromptNotFoundError when the file is
 * missing or unreadable — a prompt that vanished is a packaging fault, not a condition to paper over
 * with a silent default. Callers that must not fail a turn over it catch this and skip their step.
 */
export function loadPrompt(name: string): string {
  try {
    return readFileSync(path.join(PROMPTS_DIR, `${name}.md`), 'utf-8');
  } catch (err) {
    throw new PromptNotFoundError(name, err);
  }
}
