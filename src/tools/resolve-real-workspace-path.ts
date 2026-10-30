// resolveRealWorkspacePath — ask the CONTAINER where a path really points, and refuse it if the
// answer is outside /workspace.
//
// This exists because the host-side check is not sufficient, and a live test is what proved it. The
// model can plant a link from inside the sandbox (`execute_command` runs `ln -s / esc`; its `..` guard
// is a courtesy, not a parse). On Linux that link appears in the bind mount and host-side realpath
// catches it — but on Windows + Docker Desktop it does NOT materialize on the NTFS side, so the host
// check sees nothing, passes the path, and Docker's archive endpoint — which dereferences — reads
// straight through it. `read_file('esc/etc/hostname')` returned the container's hostname.
//
// So the guard runs where the read runs. `realpath -m` resolves every symlink in the path and does
// not require the leaf to exist, which is what keeps write_file's first write to a new file valid.
//
// It costs one exec per file operation. That is the correct trade: the alternative is a security
// check on one side of a boundary and the I/O on the other, which is the defect this whole change
// exists to close. The two inspection tools do NOT pay it — `grep -r` and `find` never traverse a
// symlink they meet, so nothing they return was reached through one.

import type { SandboxClient } from '../core/container/sandbox.js';
// True when a resolved path is /workspace itself or something strictly beneath it.
import { insideWorkspace } from './inside-workspace.js';
// Wraps the path as one shell argument, so a filename with a space or a quote survives the shell.
import { quoteShellArgument } from './quote-shell-argument.js';
import { WORKSPACE_PATH } from './workspace-path.js';

export type WorkspaceScope =
  | { readonly ok: true }
  /** `escaped` separates "points outside the project" from "the container could not answer". */
  | { readonly ok: false; readonly escaped: boolean; readonly message: string };

/**
 * Check that `relative` (project-root-relative, posix) really lands inside /workspace once every
 * symlink on it has been followed.
 */
export async function resolveRealWorkspacePath(
  sandbox: SandboxClient,
  relative: string,
): Promise<WorkspaceScope> {
  const target = relative === '' ? WORKSPACE_PATH : `${WORKSPACE_PATH}/${relative}`;
  const result = await sandbox.exec(`realpath -m -- ${quoteShellArgument(target)}`);
  if (result.exitCode !== 0) {
    return { ok: false, escaped: false, message: result.stderr.trim() || 'could not resolve the path' };
  }
  const resolved = result.stdout.trim();
  if (resolved === '') {
    return { ok: false, escaped: false, message: 'could not resolve the path' };
  }
  return insideWorkspace(resolved) ? { ok: true } : { ok: false, escaped: true, message: resolved };
}
