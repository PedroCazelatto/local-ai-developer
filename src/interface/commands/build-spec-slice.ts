// The FOCUSED context slice a Worker window is seeded with. Split out of run.ts.
//
// A slice rather than the whole spec, because a Worker's num_ctx is the scarce resource: it gets its
// own epic/story level docs plus the Architecture excerpt, and nothing else (docs/mental-model.md).
// Each document is cut from its HEAD to the `specSlice` fraction of OLLAMA_NUM_CTX, in estimated tokens
// (budget-fractions.ts) — 585 at 16 384.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { charsWithinTokens } from '../../core/llm/chars-within-tokens.js';
import { budgetTokens } from '../../core/session/budget-tokens.js';
import { levelDocs } from '../../core/session/level-docs.js';
import type { Task } from '../../core/session/task.type.js';
import { extractSection } from './extract-section.js';

/**
 * Build a FOCUSED context slice for the Worker: its epic/story level docs + the Architecture excerpt,
 * each cut to the `specSlice` budget derived from `baseNumCtx`.
 */
export function buildSpecSlice(projectPath: string, task: Task, baseNumCtx: number): string {
  // budgetTokens: the `specSlice` fraction of the ceiling, in tokens; charsWithinTokens: the most text
  // that estimate admits — what any ONE document (each level doc, and the Architecture excerpt) may carry.
  const docLimit = charsWithinTokens(budgetTokens('specSlice', baseNumCtx));
  const context: string[] = ['## Context'];
  const where = [task.epic ? `Epic: ${task.epic}` : null, task.story ? `Story: ${task.story}` : null].filter(
    (s): s is string => s !== null,
  );
  if (where.length > 0) context.push(where.join('  ·  '));

  // levelDocs: the epic's and story's own README.md bodies, absent when the file is not there.
  const docs = levelDocs(projectPath, task);
  if (docs.epic) context.push('', `### Epic (${task.epic}/README.md)`, docs.epic.slice(0, docLimit));
  if (docs.story) {
    context.push('', `### Story (${task.epic}/${task.story}/README.md)`, docs.story.slice(0, docLimit));
  }

  const specPath = path.join(projectPath, 'PRODUCT_SPEC.md');
  if (existsSync(specPath)) {
    try {
      // extractSection: one `## <heading>` body, up to the next `## ` or EOF.
      const section = extractSection(readFileSync(specPath, 'utf-8'), 'Architecture');
      if (section) context.push('', '### Architecture (excerpt from PRODUCT_SPEC.md)', section.slice(0, docLimit));
    } catch {
      /* spec unreadable — fall back to just the level-doc context */
    }
  }
  return context.join('\n');
}
