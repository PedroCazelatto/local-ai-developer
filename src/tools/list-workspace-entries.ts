// listWorkspaceEntries — walk a directory INSIDE the sandbox and return what is in it, project-root
// relative. The walk is `find` in the container rather than readdirSync on the host, for the same
// reason every other file tool moved: the host tree is reachable through a symlink planted in the
// project, and a listing that followed one would name host paths in the model's window.
//
// `-printf '%y %p\n'` is GNU findutils, which the sandbox image ships (node:24-slim is Debian-based —
// docker-compose.yml). `%y` is the type of the entry ITSELF, not of a symlink's target, so a link is
// reported as `l` and this function never descends through one.
//
// `-maxdepth` is always passed: the caller's depth is the only bound on how much of the tree comes
// back, and an unbounded walk of a project with dependencies installed is megabytes off the wire.

import type { SandboxClient } from '../core/container/sandbox.js';
// Wraps a model-supplied value as one shell argument, so a path with a space stays one path.
import { quoteShellArgument } from './quote-shell-argument.js';
import type { WorkspaceEntry } from './workspace-entry.type.js';

/** The container walk's answer: the entries, or the model-facing reason there are none. */
export type WorkspaceListing =
  | { readonly ok: true; readonly entries: readonly WorkspaceEntry[] }
  | { readonly ok: false; readonly notFound: boolean; readonly message: string };

/**
 * Entries under `relativeDir` (project-root-relative, `.` for the root) down to `depth` levels.
 *
 * Paths come back relative to the PROJECT ROOT rather than to `relativeDir`, because that is the
 * frame .gitignore rules are written in and the frame every other tool's paths are quoted in.
 */
export async function listWorkspaceEntries(
  sandbox: SandboxClient,
  relativeDir: string,
  depth: number,
): Promise<WorkspaceListing> {
  const target = relativeDir === '' ? '.' : relativeDir;
  const command = `find ${quoteShellArgument(target)} -mindepth 1 -maxdepth ${depth} -printf '%y %p\\n'`;
  const result = await sandbox.exec(command);

  if (result.exitCode !== 0 && result.stdout === '') {
    const message = result.stderr.trim();
    return { ok: false, notFound: /No such file or directory/i.test(message), message };
  }

  const entries: WorkspaceEntry[] = [];
  for (const line of result.stdout.split('\n')) {
    if (line.length < 3) continue; // '' or a truncated row — nothing addressable
    const kind = line[0] ?? '';
    // `find .` prefixes every path with `./`; `find src/core` does not. Strip it so both frames match.
    const path = line.slice(2).replace(/^\.\//, '');
    if (path === '' || path === '.') continue;
    entries.push({ path, isDirectory: kind === 'd' });
  }
  return { ok: true, entries };
}
