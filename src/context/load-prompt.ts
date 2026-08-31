// loadPrompt — read one of the orchestrator's own one-shot prompts from rules/prompts/. Which folder
// that is, and why it is deliberately outside the standards catalog, is on prompt.ts beside the
// PROMPTS_DIR constant this reads.
//
// Read FRESH on every call (never cached), matching load-phase-prompt.ts and load-catalog.ts: editing
// a prompt takes effect on the next call with no restart.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PROMPTS_DIR, PromptNotFoundError } from './prompt.js';

/**
 * Return the full text of `rules/prompts/<name>.md`. Throws PromptNotFoundError when the file is
 * missing or unreadable — a prompt that vanished is a packaging fault, not a condition to paper over
 * with a silent default. Callers that must not fail a turn over it catch this and skip their step.
 */
export function loadPrompt(name: string): string {
  try {
    return readFileSync(path.join(PROMPTS_DIR, `${name}.md`), 'utf-8');
  } catch (err) {
    // PromptNotFoundError formats the name, PROMPTS_DIR and the underlying cause into one line.
    throw new PromptNotFoundError(name, err);
  }
}
