// Batch pre-flight guard (V3/05, honoring the V3/03 systemic-patch pause). A Retro systemic fix patches
// a GLOBAL phase file under rules/phases/ and leaves it UNCOMMITTED for the user to review (constitution:
// the orchestrator's own instructions must never mutate silently). Retro can only fire from /answer —
// AFTER a synchronous /run returns — so it never runs mid-batch; the only place such an unreviewed change
// can be present is BEFORE a batch starts (a prior session's Retro patch left unreviewed). This checks the
// ORCHESTRATOR repo (not the active project) so the batch can refuse to start until the change is reviewed.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { PHASES_DIR } from '../../context/index.js';

// PHASES_DIR is <orchestratorRoot>/rules/phases; the repo root is two dirs up. Resolved from the module
// (via PHASES_DIR), never from cwd — the guard must check the orchestrator's own repo regardless of where
// it was launched.
const ORCHESTRATOR_ROOT = path.resolve(PHASES_DIR, '..', '..');

/**
 * True when the orchestrator repo has uncommitted changes under rules/phases/ (an unreviewed Retro
 * systemic patch). Never throws: if git is unavailable, returns false (the guard is a safety net, not a
 * gate that should itself break the batch) — the constitution's real enforcement is the manual-commit
 * discipline, of which this is one defense-in-depth layer.
 */
export function rulesPhasesDirty(): boolean {
  try {
    const out = execFileSync('git', ['-C', ORCHESTRATOR_ROOT, 'status', '--porcelain', '--', 'rules/phases'], {
      encoding: 'utf-8',
    });
    return out.trim() !== '';
  } catch {
    return false;
  }
}
