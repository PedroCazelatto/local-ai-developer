// The context every tool runs against. Folder vocabulary: createToolContext builds one, all 25 tools
// read from one, and the dispatcher passes it through — the shape is the directory's contract, not any
// one function's return type.

import type { SandboxClient } from '../core/container/index.js';
import type { Message, OneShotResult, OneShotRole } from '../core/llm/index.js';
import type { FileReadTracker } from '../core/session/read-tracker.type.js';
import type { SubagentHandle } from '../core/session/subagent-handle.type.js';

/**
 * The active-project binding + sandbox handle every tool runs against. `resolve` scopes a path
 * under the project root and rejects any escape (V1/03); `sandbox` is the root sandbox handle for
 * shell/container tools (V1/04); `phase` is the active phase name, recorded on the audit row.
 */
export interface ToolContext {
  readonly projectName: string; // e.g. "hello-world"
  readonly projectPath: string; // host path: projects/<active> (orchestrator-side)
  readonly workspacePath: string; // "/workspace" — the mount point inside the sandbox
  readonly sandbox: SandboxClient; // Foundation/04 dockerode handle (root sandbox)
  readonly phase: string; // active phase name, for the audit row
  /** Join `relative` onto the project root, rejecting any path that escapes it (throws on escape). */
  resolve(relative: string): string;
  /**
   * What THIS window has read, and whether those files still hold the bytes it read. read_file records
   * into it; write_file and edit_file refuse an existing file the window has not read or has read a
   * stale copy of (tools/guard-write-target.ts).
   *
   * Required, never optional: a window without a tracker would be a window where the guard silently
   * does not apply, and the one place that would be hardest to notice is the one that matters most.
   * Each runner owns exactly one, so a sub-agent's reads never satisfy its parent's guard.
   */
  readonly readTracker: FileReadTracker;
  /**
   * A fresh, HISTORY-FREE call to the session model, returning content + exact tokens. search_rules
   * (V4/02) uses it to resolve an intent against the standards catalog inside a throwaway context —
   * those turns never enter any phase's memory. Bound to the session's OllamaClient by
   * createToolContext; most tools ignore it.
   *
   * `role` is an ARGUMENT rather than something createToolContext binds, because three tools share this
   * one function and they do not all want the same ceiling: search_rules and the commit-message writer
   * are bounded, while `debate` replays uncapped model-supplied material and must stay at the base. A
   * ceiling fixed when the context was built could only have been right for one of them.
   */
  oneShot(messages: Message[], role: OneShotRole): Promise<OneShotResult>;
  /**
   * The session's sub-agent manager (V5/01), present ONLY for the interactive master phases — they can
   * spawn/ask/dismiss sub-agents. Undefined inside spawned windows (Worker/Reviewer/Retro) and inside a
   * sub-agent's own dispatch, so those cannot spawn (no nesting — also enforced by the three tools being
   * absent from their tool lists). Only the three sub-agent tools read this; every other tool ignores it.
   */
  readonly subagents?: SubagentHandle;
}
