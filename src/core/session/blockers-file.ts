// Where the blocker store lives: append-only JSONL under the project's .orchestrator/. Durable
// SESSION state (git-ignored alongside the audit log), never project history.

import path from 'node:path';

/** Absolute path to the project's blockers.jsonl (session state under .orchestrator/). */
export function blockersFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'blockers.jsonl');
}
