// /resume — reopen one of the active phase's earlier contexts (mirrors /clear). Every figure in the
// listing is DERIVED from the stored turns by one query — no LLM call, no cost. The title is the
// exception: it was written once, by a throwaway one-shot, when the context produced its first prose
// answer. A user command, never a model tool, so it lives in interface/commands/.
//
// Two ways in: `/resume <address>` reopens directly, and a bare `/resume` lists the recent contexts and
// asks for a number. The pick prompt reuses the REPL's own readline (the REPL owns stdin; fighting
// @clack for it is the pattern review-prompt.ts warns against), then repaints the pinned status bar the
// prompt drew over.
//
// A context written under a different OLLAMA_NUM_CTX is not listed and cannot be reopened — see
// memory-db.listContexts. It is hidden, never deleted: restoring the old ceiling brings it back.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import type { ContextSummary } from '../../core/session/index.js';
import { shortContextId } from '../../core/session/index.js';
import * as renderer from '../../core/ui/renderer.js';
import * as statusBar from '../../core/ui/status-bar.js';
import { theme } from '../../core/ui/theme.js';
import type { Command } from '../command-registry.js';

/** The slice of the orchestrator /resume needs — satisfied structurally by SessionOrchestrator. */
export interface ResumeOrchestrator {
  readonly activePhase: string;
  // activePhaseContexts: the active phase's last `limit` contexts, most recently active first.
  activePhaseContexts(limit: number): ContextSummary[];
  // reopenActiveContext: replay a context's visible turns into the active phase; false if the address
  // matches no single context of this phase.
  reopenActiveContext(address: string): boolean;
}

const MAX_LISTED = 5;

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/** The address form the user types and the listing shows — `design/7a888b1f`. */
function address(context: ContextSummary): string {
  return `${context.phase}/${shortContextId(context.id)}`;
}

/** Local `YYYY-MM-DD HH:mm` for a stored ISO timestamp (an unparseable value shows `unknown`). */
function localStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'unknown time';
  const d = new Date(ms);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** `47 turns` / `1 turn` — small pluralization for the count line. */
function turnLabel(count: number): string {
  return `${count} ${count === 1 ? 'turn' : 'turns'}`;
}

/**
 * Render the numbered context list (1-based). Each entry: address · last activity · turns · tokens ·
 * the model(s) that wrote it, then the title on its own line. An untitled context says so plainly —
 * it produced no prose answer for the title writer to describe, and inventing a description from its
 * raw first message is exactly what the title replaced.
 */
function renderList(phase: string, contexts: readonly ContextSummary[]): void {
  write('');
  write(theme.strong(`Contexts for ${titleCase(phase)} (most recent first):`));
  write('');
  contexts.forEach((context, i) => {
    const facts = [
      theme.strong(address(context)),
      localStamp(context.lastActivityAt),
      turnLabel(context.turnCount),
      `${context.totalTokens.toLocaleString('en-US')} tokens`,
      ...(context.models.length > 0 ? [context.models.join(' + ')] : []),
    ];
    write(`  ${i + 1}) ${facts.join(' · ')}`);
    write(context.title === null ? theme.meta('     (untitled)') : theme.meta(`     "${context.title}"`));
    write('');
  });
}

/** Reopen `address`, reporting either the restored context or a recoverable line. */
function reopen(orch: ResumeOrchestrator, target: string, described: string): void {
  if (!orch.reopenActiveContext(target)) {
    renderer.errorLine(`No single ${titleCase(orch.activePhase)} context matches '${target}'.`);
    return;
  }
  renderer.systemMessage(`Reopened ${described}`);
}

async function resumeContext(orch: ResumeOrchestrator, rl: ReadlineInterface, args: string[]): Promise<void> {
  const phase = orch.activePhase;

  // `/resume <address>` — a full UUID or any unique prefix, with or without the `<phase>/` label the
  // listing prints. Strip the label so a user can paste back exactly what they were shown.
  const typed = args[0];
  if (typed !== undefined && typed.trim() !== '') {
    const bare = typed.includes('/') ? (typed.split('/').pop() ?? '') : typed;
    reopen(orch, bare, `${phase}/${shortContextId(bare)}`);
    return;
  }

  const contexts = orch.activePhaseContexts(MAX_LISTED);
  if (contexts.length === 0) {
    renderer.systemMessage(`No earlier contexts for ${titleCase(phase)}`);
    return;
  }

  renderList(phase, contexts);

  // Reuse the REPL's readline for the pick; repaint the bar the prompt's ESC[0J erased (as repl.ts does).
  const answer = (await rl.question(`Pick 1-${contexts.length} to reopen, anything else to cancel: `)).trim();
  statusBar.repaint();

  const pick = Number(answer);
  const chosen = Number.isInteger(pick) && pick >= 1 && pick <= contexts.length ? contexts[pick - 1] : undefined;
  if (chosen === undefined) {
    renderer.systemMessage('Cancelled — nothing reopened.');
    return;
  }
  const described = chosen.title === null ? address(chosen) : `${address(chosen)} "${chosen.title}"`;
  reopen(orch, chosen.id, `${described} · ${turnLabel(chosen.turnCount)}`);
}

export const resumeCommand: Command = {
  name: 'resume',
  group: 'session',
  description: "Reopen one of the active phase's earlier contexts",
  usage: '/resume [<address>]',
  run: (ctx) => resumeContext(ctx.orch, ctx.rl, ctx.args),
};
