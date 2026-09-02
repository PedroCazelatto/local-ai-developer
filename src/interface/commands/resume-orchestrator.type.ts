// The slice of the orchestrator /resume needs. Its own module rather than a declaration inside one
// function's file because it has no single owner: reopen-context.ts and resume-context.ts BOTH take
// it, co-equally, and neither is the one the other serves. The test is what would own it, not how many
// files import it — and when the honest answer is "two, co-equally", nothing does.

import type { ContextSummary } from '../../core/session/index.js';

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
