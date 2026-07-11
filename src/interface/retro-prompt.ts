// REPL renderer for the Retro outcome (V3/03). Terminal-UX first (constitution): a scope-coded
// headline, the one-sentence root cause, the single file patched, and — for a SYSTEMIC patch — the LOUD
// warning that the uncommitted rules/phases change must be reviewed + committed manually before the loop
// continues (the whole point of the task: the orchestrator's own instructions never mutate silently).
// Pure printing; wraps naturally, no horizontal scroll. Mirrors review-prompt.ts.

import path from 'node:path';

import type { RetroResult } from '../core/session/index.js';
import { theme } from '../core/ui/theme.js';

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Exact token line — never a length estimate; says "not reported" when a metric was omitted. */
function tokenLine(result: RetroResult): string {
  const prompt = result.tokens.promptTokens === null ? 'not reported' : String(result.tokens.promptTokens);
  const evalT = result.tokens.evalTokens === null ? 'not reported' : String(result.tokens.evalTokens);
  return theme.meta(`Retro tokens — prompt: ${prompt}, eval: ${evalT}`);
}

/** A readable path for the patched file: project-relative when inside the project, else as resolved. */
function displayPath(result: RetroResult, projectPath: string): string {
  if (result.scope === 'systemic') {
    return `rules/phases/${path.basename(result.editedFile)}`;
  }
  const rel = path.relative(projectPath, result.editedFile);
  return rel.startsWith('..') ? result.editedFile : rel;
}

/**
 * Render one Retro outcome. `projectPath` is the active project root, used only to show a friendly
 * relative path for a task-specific patch.
 */
export function renderRetroResult(result: RetroResult, projectPath: string): void {
  write('');
  const badge = result.scope === 'systemic' ? theme.danger(' SYSTEMIC ') : theme.success(' TASK-SPECIFIC ');
  write(`${theme.strong('Retro')} ${badge}`);
  write(theme.meta(`Root cause: ${result.rootCause}`));
  write(`Patched: ${theme.strong(displayPath(result, projectPath))}`);

  if (result.scope === 'systemic') {
    // The loud, unmissable warning — an uncommitted global-instruction change must be reviewed first.
    write('');
    write(theme.danger('⚠ GLOBAL INSTRUCTION CHANGE — NOT COMMITTED'));
    if (result.reviewWarning !== undefined) write(theme.danger(result.reviewWarning));
    write(theme.danger('Review it and commit it manually in the orchestrator repo BEFORE running more tasks.'));
  } else if (result.committed) {
    write(theme.meta('Committed with the project (task-specific fix).'));
  } else if (result.reviewWarning !== undefined) {
    write(theme.error(result.reviewWarning));
  }

  write(tokenLine(result));
  write('');
}
