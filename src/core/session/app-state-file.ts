// The single host-global state file. Both the reader and the writer derive its path from here, so
// there is no second spelling of it to drift.

import path from 'node:path';

import { appStateDir } from './app-state-dir.js';

/** The single global state file, ~/.local-ai-developer/state.json. */
export function appStateFile(): string {
  // appStateDir: ~/.local-ai-developer, resolved via os.homedir().
  return path.join(appStateDir(), 'state.json');
}
