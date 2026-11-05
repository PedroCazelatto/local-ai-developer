import path from 'node:path';

/**
 * Absolute path to the harness events log as it was kept BEFORE backlog item 19 moved it into memory.db.
 * Nothing writes or reads it any more; /events only checks it exists, to say where the older rows are.
 */
export function eventsLogFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'events.jsonl');
}
