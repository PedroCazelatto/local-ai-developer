// ToolContext construction + the path-scoping `resolve` (ported verbatim from tools/base.py's
// ToolContext.resolve). Path scoping is the security boundary for the host-side file tools (V1/03):
// every path a tool touches is resolved under the active project root, and any escape (`..`,
// absolute paths landing outside root, etc.) is rejected. The shell/container tools (V1/04/05) get
// their guarantee from the Docker mount instead, but they share this same context.

import path from 'node:path';

import type { SandboxClient } from '../core/container/index.js';
import type { ToolContext } from './types.js';

/** "/workspace" — where the active project is bind-mounted inside the sandbox (Foundation/04). */
export const WORKSPACE_PATH = '/workspace';

/**
 * Join `relative` onto `projectPath` and reject any path that escapes the project root. Mirrors the
 * Python: resolve both to absolute; allow only the root itself or paths strictly under `root + sep`.
 * Throws (the file tools catch this and return the structured escape error) — never returns an
 * out-of-project path.
 */
export function resolveInProject(projectPath: string, relative: string): string {
  const root = path.resolve(projectPath);
  const resolved = path.resolve(root, relative);
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
}

/** Build the ToolContext for a dispatch: binds `resolve` to the active project + fixes /workspace. */
export function createToolContext(init: ToolContextInit): ToolContext {
  return {
    projectName: init.projectName,
    projectPath: init.projectPath,
    workspacePath: WORKSPACE_PATH,
    sandbox: init.sandbox,
    phase: init.phase,
    resolve: (relative: string): string => resolveInProject(init.projectPath, relative),
  };
}
