// Where the backlog tree lives. COMMITTED project content (a human-browseable plan + progress trail),
// deliberately not session state under .orchestrator/ — the Breakdown phase writes it through the
// model's write_file tool and a human reads it in the repo.

import path from 'node:path';

/** Folder holding the backlog tree, relative to the project root. Committed (not session state). */
export const BACKLOG_DIRNAME = 'backlog';

/** Absolute path to the project's backlog/ tree. */
export function backlogRoot(projectPath: string): string {
  return path.join(projectPath, BACKLOG_DIRNAME);
}
