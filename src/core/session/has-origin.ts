// Is there a destination at all? The other half of "no repository" — a project that was never given a
// remote, as opposed to one whose remote does not resolve.

import { REMOTE } from './push-remote.js';
import { runGit } from './run-git.js';

/** True when `origin` is configured at all. Its absence is the other half of "no destination". */
export function hasOrigin(projectPath: string): boolean {
  return runGit(projectPath, ['remote'])
    .stdout.split('\n')
    .map((line) => line.trim())
    .includes(REMOTE);
}
