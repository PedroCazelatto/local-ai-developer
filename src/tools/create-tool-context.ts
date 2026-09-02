// ToolContext construction: the one place a dispatched call's project binding, sandbox handle, read
// tracker and one-shot channel are wired together. It runs once per dispatched call, which is why
// nothing stateful is built here — see readTracker below.

import type { SandboxClient } from '../core/container/index.js';
import { oneShot } from '../core/llm/index.js';
import type { Message, OllamaClient, OneShotResult, OneShotRole } from '../core/llm/index.js';
import type { FileReadTracker } from '../core/session/read-tracker.type.js';
import type { SubagentHandle } from '../core/session/subagent-handle.type.js';
// Joins a path onto the project root and throws on any escape, symlinks resolved.
import { resolveInProject } from './resolve-in-project.js';
import type { ToolContext } from './tool-context.type.js';
import { WORKSPACE_PATH } from './workspace-path.js';

export interface ToolContextInit {
  readonly projectName: string;
  readonly projectPath: string;
  readonly sandbox: SandboxClient;
  readonly phase: string;
  /** The session's OllamaClient — backs ctx.oneShot for the standards-retrieval tools (V4/02). */
  readonly llm: OllamaClient;
  /**
   * THIS window's read tracker (core/session/read-tracker.ts). One per window and passed in rather than
   * created here: createToolContext runs once per dispatched call, so a tracker built here would forget
   * every read the moment the call returned — the state belongs to the runner, which is the window.
   */
  readonly readTracker: FileReadTracker;
  /**
   * The session's sub-agent manager (V5/01), passed ONLY by the orchestrator for interactive master
   * phases. Omitted by the spawned-window runners (Worker/Reviewer/Retro) and the sub-agent's own
   * dispatch, so `ctx.subagents` is undefined there and the sub-agent tools degrade to a recoverable error.
   */
  readonly subagents?: SubagentHandle;
}

/**
 * Build the ToolContext for a dispatch: binds `resolve` to the active project + fixes /workspace, and
 * binds `oneShot` to a fresh, history-free call against the session model (search_rules, V4/02).
 *
 * The two arrows below are properties of an object this function BUILDS AND RETURNS, so they are its
 * implementation rather than declarations of their own (constitution, "what counts, exactly").
 */
export function createToolContext(init: ToolContextInit): ToolContext {
  return {
    projectName: init.projectName,
    projectPath: init.projectPath,
    workspacePath: WORKSPACE_PATH,
    sandbox: init.sandbox,
    phase: init.phase,
    resolve: (relative: string): string => resolveInProject(init.projectPath, relative),
    readTracker: init.readTracker, // the WINDOW's tracker, outliving this per-call context

    // The ROLE comes from the calling tool, not from here — see ToolContext.oneShot for why binding one
    // ceiling at construction could only ever have been right for one of the three tools that share it.
    oneShot: (messages: Message[], role: OneShotRole): Promise<OneShotResult> =>
      oneShot(init.llm, messages, role),
    subagents: init.subagents, // undefined for every context except the interactive master phases (V5/01)
  };
}
