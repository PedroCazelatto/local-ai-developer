// Host-side git for the ACTIVE project. The orchestrator is the only host-side process (CLAUDE.md),
// so this runs git on the HOST against projects/<name> — NOT in a container: the node:24-slim sandbox
// ships no git.

import { runGit } from './run-git.js';

/** True when the project working tree has ANY uncommitted change (tracked edits OR untracked files). */
export function isWorkingTreeDirty(projectPath: string): boolean {
  return runGit(projectPath, ['status', '--porcelain']).stdout.trim() !== '';
}
