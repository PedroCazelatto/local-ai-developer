// ToolContext construction + the path-scoping `resolve` (ported from tools/base.py's
// ToolContext.resolve). EVERY model-callable tool now does its file work inside the container, so
// the Docker mount is the security boundary; `resolve` is the VALIDATOR that runs first, rejecting a
// path that leaves the project with a message the model can act on, and it is the only scoping the
// host-side git tools (commit_changes, git_inspect) and the Retro single-file lock have at all.
//
// It resolves symlinks. A lexical prefix check is not enough: `execute_command` can create a link
// inside /workspace (its `..` guard is a courtesy, not a parse), that link materializes inside the
// project directory on the host, and a purely lexical `path.resolve` would then hand git a path that
// looks in-project and points anywhere. realpathSync on the deepest EXISTING ancestor closes that,
// while still validating a path whose leaf has not been created yet.

import path from 'node:path';

import type { SandboxClient } from '../core/container/index.js';
import { oneShot } from '../core/llm/index.js';
import type { Message, OllamaClient, OneShotResult, OneShotRole } from '../core/llm/index.js';
import type { FileReadTracker } from '../core/session/read-tracker.type.js';
import type { SubagentHandle } from '../core/session/subagents.type.js';
// Resolves a path through symlinks without requiring its leaf to exist yet.
import { realPathOfNearestExisting } from './real-path-of-nearest-existing.js';
import type { ToolContext } from './types.js';

/** "/workspace" — where the active project is bind-mounted inside the sandbox (Foundation/04). */
export const WORKSPACE_PATH = '/workspace';

/**
 * Join `relative` onto `projectPath` and reject any path that escapes the project root: allow only
 * the root itself or paths strictly under `root + sep`. Throws (every caller catches this and
 * returns the structured escape error) — never returns an out-of-project path.
 *
 * BOTH sides go through realPathOfNearestExisting, which resolves symlinks down to the deepest
 * ancestor that exists — so a link planted inside the project cannot present an outside target as an
 * inside path, and a file that does not exist yet still validates. The root is resolved too: the
 * comparison is meaningless if one side is real and the other lexical.
 */
export function resolveInProject(projectPath: string, relative: string): string {
  const root = realPathOfNearestExisting(projectPath);
  const resolved = realPathOfNearestExisting(path.resolve(root, relative));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path '${relative}' escapes the project directory`);
  }
  return resolved;
}

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
