// An untracked file's body as a diff-style block. `git diff` omits new files entirely, so both diff
// builders (capture-changed-files.ts and diff-paths.ts) append them through here — read from the HOST
// filesystem, never mutating anything.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** Render a new (untracked) file as a diff-style block, reading its content from the host fs. */
export function renderNewFile(projectPath: string, rel: string): string {
  const abs = path.join(projectPath, rel);
  try {
    if (!existsSync(abs) || statSync(abs).isDirectory()) return '';
    return `--- new file: ${rel} ---\n${readFileSync(abs, 'utf-8')}`;
  } catch {
    return `--- new file: ${rel} --- (unreadable)`;
  }
}
