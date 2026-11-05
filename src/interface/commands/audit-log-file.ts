// Where a project's tool-call audit log lives. Split out of read-audit-rows.ts.

import path from 'node:path';

/**
 * Absolute path to the tool-call audit log as it was kept BEFORE backlog item 19 moved it into memory.db.
 * Nothing writes or reads it any more; /audit only checks it exists, to say where the older rows are.
 */
export function auditLogFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'tool_audit.jsonl');
}
