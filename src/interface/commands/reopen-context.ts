// Reopen one context by address and report it. Split out of resume.ts, where it was the private
// `reopen` — a bare verb that as a file name would not have said what is reopened.
//
// BOTH ways into /resume funnel through here — the numbered pick and `/resume <address>` — so the two
// cannot drift into warning differently, which is exactly the hole a marker on the listing alone would
// leave: an address typed straight in never sees a listing.

import { capitalizePhase } from '../../core/ui/capitalize-phase.js';
import { renderer } from '../../core/ui/renderer.js';
import type { ResumeOrchestrator } from './resume-orchestrator.type.js';
import { warnSmallerCeiling } from './warn-smaller-ceiling.js';

/** Reopen `target`, reporting either the restored context or one recoverable line, then warn if needed. */
export function reopenContext(orch: ResumeOrchestrator, target: string, described: string): void {
  // reopenActiveContext: replays the context's visible turns into the active phase and hands back its
  // listing row. Null means one thing only — no single context of this phase matches the address.
  const restored = orch.reopenActiveContext(target);
  if (restored === null) {
    // capitalizePhase: phase ids are lowercase in-code; display them Titlecased.
    renderer.errorLine(`No single ${capitalizePhase(orch.activePhase)} context matches '${target}'.`);
    return;
  }
  renderer.systemMessage(`Reopened ${described}`);
  // warnSmallerCeiling: names both ceilings, and is a no-op when they match.
  warnSmallerCeiling(restored, orch.numCtx);
}
