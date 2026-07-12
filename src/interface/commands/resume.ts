// /resume (V4/04) — restore ONE of the active phase's last-3 archives (mirrors /clear). Every line of
// the listing is derived DIRECTLY from the archived JSONL — no LLM call, no cost (contrast V4/05's
// throwaway summary call). A user command, never a model tool, so it lives in interface/commands/.
//
// It reuses the REPL's own readline for the pick prompt (the REPL owns stdin; fighting @clack for it
// is the pattern review-prompt.ts warns against), then repaints the pinned status bar the prompt drew
// over. On a valid 1-3 it restores + reloads; anything else cancels.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import type { ArchiveSummary } from '../../core/session/index.js';
import * as renderer from '../../core/ui/renderer.js';
import * as statusBar from '../../core/ui/status-bar.js';
import { theme } from '../../core/ui/theme.js';
import type { Command } from '../command-registry.js';

/** The slice of the orchestrator /resume needs — satisfied structurally by SessionOrchestrator. */
export interface ResumeOrchestrator {
  readonly activePhase: string;
  // activePhaseArchives: the last `limit` archives for the active phase, most recent first (from JSONL).
  activePhaseArchives(limit: number): ArchiveSummary[];
  // resumeActivePhaseArchive: swap a chosen archive back into the active file and reload it into RAM.
  resumeActivePhaseArchive(basename: string): void;
}

const MAX_LISTED = 3;
const CLIP = 80;

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/** Collapse whitespace and clip to ~CLIP chars with an ellipsis — keeps each preview to one line. */
function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat === '') return '(no user messages)';
  return flat.length <= CLIP ? flat : `${flat.slice(0, CLIP - 1).trimEnd()}…`;
}

/** Local `YYYY-MM-DD HH:mm` for the archive timestamp (NaN ms — a malformed name — shows `unknown`). */
function localStamp(ms: number): string {
  if (Number.isNaN(ms)) return 'unknown time';
  const d = new Date(ms);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** `47 turns` / `1 turn` — small pluralization for the count line. */
function turnLabel(count: number): string {
  return `${count} ${count === 1 ? 'turn' : 'turns'}`;
}

/** Render the numbered archive list (1-based), each: stamp · turns · tokens, then first→last user turn. */
function renderList(phase: string, archives: readonly ArchiveSummary[]): void {
  write('');
  write(theme.strong(`Archives for ${titleCase(phase)} (most recent first):`));
  write('');
  archives.forEach((a, i) => {
    const tokens = `${a.totalTokens.toLocaleString('en-US')} tokens`;
    write(`  ${i + 1}) ${theme.strong(localStamp(a.archivedAtMs))} · ${turnLabel(a.turnCount)} · ${tokens}`);
    write(theme.meta(`     "${clip(a.firstUser)}"`));
    write(theme.meta(`     → "${clip(a.lastUser)}"`));
    write('');
  });
}

async function resumeArchive(orch: ResumeOrchestrator, rl: ReadlineInterface): Promise<void> {
  const phase = orch.activePhase;
  const archives = orch.activePhaseArchives(MAX_LISTED);
  if (archives.length === 0) {
    renderer.systemMessage(`No archives for ${titleCase(phase)}`);
    return;
  }

  renderList(phase, archives);

  // Reuse the REPL's readline for the pick; repaint the bar the prompt's ESC[0J erased (as repl.ts does).
  const answer = (await rl.question(`Pick 1-${archives.length} to restore, anything else to cancel: `)).trim();
  statusBar.repaint();

  const pick = Number(answer);
  if (!Number.isInteger(pick) || pick < 1 || pick > archives.length) {
    renderer.systemMessage('Cancelled — nothing restored.');
    return;
  }

  const chosen = archives[pick - 1];
  if (chosen === undefined) {
    renderer.systemMessage('Cancelled — nothing restored.');
    return;
  }
  try {
    orch.resumeActivePhaseArchive(chosen.file);
    renderer.systemMessage(`Restored ${titleCase(phase)} · ${turnLabel(chosen.turnCount)} from ${localStamp(chosen.archivedAtMs)}`);
  } catch (err) {
    renderer.errorLine(`Couldn't restore: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export const resumeCommand: Command = {
  name: 'resume',
  group: 'session',
  description: "Restore one of the active phase's recent history archives",
  run: (ctx) => resumeArchive(ctx.orch, ctx.rl),
};
