// Where a project's tool-call audit log lives. Split out of read-audit-rows.ts.

import path from 'node:path';

/** Absolute path to a project's tool-call audit log (durable session state under .orchestrator/). */
export function auditLogFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'tool_audit.jsonl');
}
