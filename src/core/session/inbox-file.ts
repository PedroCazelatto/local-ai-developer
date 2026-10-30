// ONE inbox file per RECIPIENT phase (worker.jsonl, reviewer.jsonl, …), created on first write. The
// per-recipient split is what makes reading an inbox cheap: the active phase replays only its own
// file, because a post addressed to it lives there and nowhere else.

import path from 'node:path';

import type { Phase } from './phase.type.js';

/** Absolute path to a recipient phase's inbox file (lowercased name, e.g. `worker.jsonl`). */
export function inboxFile(projectPath: string, phase: Phase): string {
  return path.join(projectPath, '.orchestrator', 'inbox', `${phase.toLowerCase()}.jsonl`);
}
