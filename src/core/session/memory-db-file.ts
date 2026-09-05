// projects/<active>/.orchestrator/memory.db — one database per project, beside its other stores.

import path from 'node:path';

/** Absolute path to the project's phase-memory database. */
export function memoryDbFile(projectPath: string): string {
  return path.join(projectPath, '.orchestrator', 'memory.db');
}
