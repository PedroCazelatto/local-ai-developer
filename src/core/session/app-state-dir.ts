// ~/.local-ai-developer — the host-global orchestrator directory (V5/02).
//
// HOST-WIDE deliberately, not under a project's .orchestrator/: what it holds is the user's model
// choice, and a model is a hardware choice, agnostic to which project is open (task 02 "State scope").
// `~` is resolved through os.homedir(), never as a literal.

import os from 'node:os';
import path from 'node:path';

/** ~/.local-ai-developer — the host-global orchestrator dir (os.homedir() resolves `~`). */
export function appStateDir(): string {
  return path.join(os.homedir(), '.local-ai-developer');
}
