// edit_phase_rule (V3/03) — the Retro window's phase-scoped EDIT tool for the orchestrator's OWN
// instruction set: the SYSTEMIC fix path. It patches a global phase file under rules/phases/ with a
// smallest-correct exact-string replace (old_string must appear EXACTLY once — same discipline as
// edit_file), so Retro cannot silently rewrite a whole phase. Like the other phase-scoped tools it is
// NOT in the global registry: only the spawned Retro window offers it and applies it directly.
//
// Scope is enforced by NAME (`phase` must be an existing phase file — no `..`/absolute-path traversal),
// and the write is left UNCOMMITTED on disk: the orchestrator NEVER auto-commits a rules change
// (constitution: the orchestrator's own instructions must never mutate silently). The commit invariant
// is ALSO guarded downstream (the Retro window's path guard + commitPaths' repo-escape refusal), so this
// is one layer of defense in depth, not the only one.

import { readFileSync, writeFileSync } from 'node:fs';

import { availablePhaseNames, phasePromptPath } from '../context/index.js';
import type { Tool } from '../core/llm/index.js';

/** The one name the Retro window special-cases to patch a global phase instruction file. */
export const EDIT_PHASE_RULE = 'edit_phase_rule';

/** The Ollama tool definition appended to the Retro window's tool list (never the global registry). */
export const editPhaseRuleTool: Tool = {
  type: 'function',
  function: {
    name: EDIT_PHASE_RULE,
    description:
      'Patch a GLOBAL phase instruction file under rules/phases/ (the SYSTEMIC fix). Replaces an exact ' +
      "string that must appear exactly once — if 'old_string' is missing or matches multiple times, no " +
      'change is made (add surrounding context to disambiguate). Make the SMALLEST correct edit; never ' +
      'rewrite a whole phase. The change is left UNCOMMITTED for the user to review before continuing.',
    parameters: {
      type: 'object',
      required: ['phase', 'old_string', 'new_string'],
      properties: {
        phase: {
          type: 'string',
          description: 'Phase file name without extension, e.g. "discovery", "reviewer".',
        },
        old_string: {
          type: 'string',
          description: 'Exact text to find. Must match verbatim, including whitespace, and appear exactly once.',
        },
        new_string: { type: 'string', description: 'Text that replaces old_string.' },
      },
    },
  },
};

/** Result of an edit_phase_rule call: the patched path, or a structured recoverable error. */
export type PhaseRuleEdit =
  | { readonly ok: true; readonly resolvedPath: string; readonly phase: string }
  | { readonly ok: false; readonly error: string; readonly hint?: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Count non-overlapping occurrences of `needle` in `haystack` (matches edit_file's semantics). */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/** Apply a smallest-correct exact-once replace to rules/phases/<phase>.md; leaves the write uncommitted. */
export function applyPhaseRuleEdit(phase: unknown, oldString: unknown, newString: unknown): PhaseRuleEdit {
  if (typeof phase !== 'string' || phase.trim() === '') {
    return { ok: false, error: "'phase' must be a non-empty string." };
  }
  if (typeof oldString !== 'string' || typeof newString !== 'string') {
    return { ok: false, error: "'old_string' and 'new_string' must be strings." };
  }
  if (oldString === newString) {
    return { ok: false, error: "'old_string' and 'new_string' are identical — nothing to do." };
  }
  const normalized = phase.trim().toLowerCase();
  const available = availablePhaseNames();
  if (!available.includes(normalized)) {
    return { ok: false, error: `unknown phase '${normalized}'.`, hint: `Available phases: ${available.join(', ')}` };
  }
  const file = phasePromptPath(normalized);

  let original: string;
  try {
    original = readFileSync(file, 'utf-8');
  } catch (err) {
    return { ok: false, error: `could not read rules/phases/${normalized}.md: ${messageOf(err)}` };
  }
  const occurrences = countOccurrences(original, oldString);
  if (occurrences === 0) {
    return { ok: false, error: `'old_string' not found in rules/phases/${normalized}.md.` };
  }
  if (occurrences > 1) {
    return {
      ok: false,
      error: `'old_string' matches ${occurrences} times in rules/phases/${normalized}.md. Add surrounding context to make it unique.`,
    };
  }
  const index = original.indexOf(oldString);
  const updated = original.slice(0, index) + newString + original.slice(index + oldString.length);
  try {
    writeFileSync(file, updated, 'utf-8');
  } catch (err) {
    return { ok: false, error: `could not write rules/phases/${normalized}.md: ${messageOf(err)}` };
  }
  return { ok: true, resolvedPath: file, phase: normalized };
}
