// Spawn a fresh Retro window (V3/03), run it to completion streaming to the REPL with every tool call
// audited, and route its single edit to a RetroResult. The window is DISCARDED when this resolves: it
// sees only { task, misunderstanding, answer } and never the Worker's or Reviewer's turns (CLAUDE.md
// memory model).
//
// Throws RetroError when the Retro produced no edit or never submitted a diagnosis. That is
// best-effort learning failing, not the session failing -- the caller keeps going and the user's answer
// is already recorded.

import { buildSystemPrompt, loadPhasePrompt } from '../../context/index.js';
import { resolvePhaseTools } from '../../phases/resolve-phase-tools.js';
import { SUBMIT_RETRO } from '../../tools/submit-retro.js';
import { buildRetroSeed } from './build-retro-seed.js';
import { RetroError } from './retro-error.js';
import type { RetroDeps } from './retro-deps.type.js';
import type { RetroInput } from './retro-input.type.js';
import type { RetroResult } from './retro-result.type.js';
import { RetroWindow } from './retro-window.js';
import { routeRetroEdit } from './route-retro-edit.js';
import { processMessage } from './process-message.js';

// Retro reads a couple of files (task doc / phase file) then makes one edit and submits — lighter than
// the Worker's implement loop. Give headroom for a few reads + a re-tried edit before the cap trips.
const RETRO_MAX_ROUNDS = 16;

/**
 * Spawn a fresh Retro window, run it to completion (streaming to the REPL, all tool calls audited), and
 * route its single edit to a RetroResult. The window is discarded when this resolves. Throws RetroError
 * if the Retro produced no edit or never submitted a diagnosis (best-effort learning — the caller keeps
 * the session alive and the answer already recorded).
 */
export async function spawnRetro(deps: RetroDeps, input: RetroInput): Promise<RetroResult> {
  // Same pure resolve the window uses for its own defs, so the prompt's "# Your Tools" list names
  // read_phase_rule/edit_phase_rule/submit_retro exactly as the window sends them.
  const systemPrompt = buildSystemPrompt(
    loadPhasePrompt('retro'),
    resolvePhaseTools('retro'),
    `Project: ${deps.projectName}`,
  );
  const window = new RetroWindow(deps, systemPrompt);
  await processMessage(window, buildRetroSeed(input), RETRO_MAX_ROUNDS);

  const editedAbs = window.editedFile;
  const submission = window.submission;
  if (editedAbs === null) {
    throw new RetroError(`The Retro ended after ${RETRO_MAX_ROUNDS} rounds without patching any file.`);
  }
  if (submission === null) {
    throw new RetroError(`The Retro edited ${editedAbs} but ended without calling ${SUBMIT_RETRO}.`);
  }
  return routeRetroEdit(deps, input.task, editedAbs, submission, window.tokens);
}
