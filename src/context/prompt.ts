// The rules/prompts/ location and the typed failure for reading one — the vocabulary loadPrompt
// (load-prompt.ts) is built on. It holds NO function of its own: a constant and one error class,
// the same shape phase-prompt.ts and standards-catalog.ts keep for their own rules folder.
//
// A THIRD rules folder, and deliberately not part of the standards catalog: rules/standards/ is the
// on-demand library the model searches with `search_rules` and pulls with `load_rule`, so a file there
// is something the model may choose to read. These files are the other direction — instructions the
// ORCHESTRATOR injects into a throwaway context the model never chooses to enter. Putting one in
// standards/ would offer the model a prompt written to be used on it (docs/rules-loading.md).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// rules/prompts/ sits at the orchestrator repo root, resolved relative to THIS file — never to the
// active project (rules are GLOBAL; projects are agnostic to the orchestrator — CLAUDE.md). This file
// is <root>/src/context/prompt.ts (tsx) or <root>/dist/context/prompt.js (built), both two dirs below
// root, so `../../rules/prompts` resolves to the repo root in either run mode.
export const PROMPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'rules', 'prompts');

/** Typed failure so a caller can tell a missing prompt from any other I/O error and stay recoverable. */
export class PromptNotFoundError extends Error {
  constructor(name: string, cause: unknown) {
    super(`prompt '${name}' could not be read from ${PROMPTS_DIR}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'PromptNotFoundError';
  }
}
