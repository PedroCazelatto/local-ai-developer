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
// OLLAMA_NUM_CTX cuts across both. A context written under a LARGER ceiling is not listed and cannot be
// reopened — see memory-db.listContexts; it is hidden, never deleted, and restoring the old ceiling
// brings it back. A context written under a SMALLER one is reachable, because a history that fitted
// 8 192 fits 16 384, but it is not silently reachable: the listing MARKS it, so the mismatch is visible
// before the choice is made, and the restore warns on top of that, naming both ceilings. Either half
// alone leaves a hole — the marker cannot reach `/resume <address>`, and a warning after the fact
// arrives once the context is already open.

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
  /**
   * This session's OLLAMA_NUM_CTX — the ceiling every listed context is compared against. The raw
   * configured value, never a per-window one (see SessionOrchestrator.numCtx).
   */
  readonly numCtx: number;
  // activePhaseContexts: the active phase's last `limit` contexts, most recently active first.
  activePhaseContexts(limit: number): ContextSummary[];
  // reopenActiveContext: replay a context's visible turns into the active phase, returning the context
  // it reopened; null if the address matches no single context of this phase.
  reopenActiveContext(address: string): ContextSummary | null;
}

const MAX_LISTED = 5;

/** The warning glyph the rest of the UI uses (batch-summary.ts, retro-prompt.ts, turn-loop.ts). */
const WARN = '⚠';

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

/** A token ceiling as the listing writes every other figure — `16,384`, grouped, never abbreviated. */
function ceiling(numCtx: number): string {
  return numCtx.toLocaleString('en-US');
}

/**
 * Whether this context predates a RAISE of OLLAMA_NUM_CTX — it was written to fit a smaller window than
 * the session now runs. The other direction cannot appear here: a context written under a larger ceiling
 * is filtered out of the query entirely (memory-db.listContexts), which is the safety half of the rule.
 */
function isUnderSmallerCeiling(context: ContextSummary, sessionNumCtx: number): boolean {
  return context.numCtx < sessionNumCtx;
}

/**
 * Render the numbered context list (1-based). Each entry: address · last activity · turns · tokens ·
 * the model(s) that wrote it, then the title on its own line. An untitled context says so plainly —
 * it produced no prose answer for the title writer to describe, and inventing a description from its
 * raw first message is exactly what the title replaced.
 *
 * A context written under a smaller ceiling carries a marked fact of its own, and the list closes with
 * the legend explaining it — the `/models list` shape, where the mark sits on the row and the meaning
 * sits once at the bottom. The legend also states what is NOT in the list, for the same reason
 * `/models list` shows toolless models rather than dropping them: a listing should explain its own
 * omissions instead of leaving the user to wonder where a context went.
 */
function renderList(phase: string, contexts: readonly ContextSummary[], sessionNumCtx: number): void {
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
      ...(isUnderSmallerCeiling(context, sessionNumCtx)
        ? [theme.danger(`${WARN} num_ctx ${ceiling(context.numCtx)}`)]
        : []),
    ];
    write(`  ${i + 1}) ${facts.join(' · ')}`);
    write(context.title === null ? theme.meta('     (untitled)') : theme.meta(`     "${context.title}"`));
    write('');
  });
  if (!contexts.some((context) => isUnderSmallerCeiling(context, sessionNumCtx))) return;
  write(
    theme.meta(`  ${WARN} written under a smaller OLLAMA_NUM_CTX than this session's ${ceiling(sessionNumCtx)} — safe to reopen.`),
  );
  write(theme.meta('  Anything written under a LARGER ceiling stays hidden: replaying it would silently drop its oldest turns.'));
  write('');
}

/**
 * Say that the context just restored was written to fit a smaller window. It NAMES BOTH CEILINGS on
 * purpose: "written under a smaller window" is not diagnosable, and "written under 8,192 while this
 * session runs at 16,384" tells the user exactly which change of theirs explains the shorter history
 * they are looking at. It reads as a warning, not a failure, because nothing failed — the replay is
 * safe, and that is the second line's job to say.
 */
function warnSmallerCeiling(context: ContextSummary, sessionNumCtx: number): void {
  if (!isUnderSmallerCeiling(context, sessionNumCtx)) return;
  write(
    theme.danger(
      `${WARN} Written under OLLAMA_NUM_CTX ${ceiling(context.numCtx)}; this session runs at ${ceiling(sessionNumCtx)}.`,
    ),
  );
  write(theme.meta('  Safe to replay — a smaller history fits a larger window — but it was written to fit the smaller one.'));
}

/**
 * Reopen `address`, reporting either the restored context or a recoverable line, then warn if what came
 * back was written for a smaller window. BOTH ways into the command funnel through here — the numbered
 * pick and `/resume <address>` — so the two cannot drift into warning differently, which is exactly the
 * hole a marker on the listing alone would leave: an address typed straight in never sees a listing.
 */
function reopen(orch: ResumeOrchestrator, target: string, described: string): void {
  // reopenActiveContext: replays the context's visible turns into the active phase and hands back its
  // listing row. Null means one thing only — no single context of this phase matches the address.
  const restored = orch.reopenActiveContext(target);
  if (restored === null) {
    renderer.errorLine(`No single ${titleCase(orch.activePhase)} context matches '${target}'.`);
    return;
  }
  renderer.systemMessage(`Reopened ${described}`);
  // warnSmallerCeiling: names both ceilings, and is a no-op when they match.
  warnSmallerCeiling(restored, orch.numCtx);
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

  renderList(phase, contexts, orch.numCtx);

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
