// Turn a model-supplied project-relative path into the posix path the sandbox transport wants, and
// prove it stays inside the project on the way. Returns the scoped path, or the model-facing reason
// it is not one — the same "escapes the project directory" wording the tools have always used.
//
// TWO checks, because neither is sufficient alone:
//
//   1. ctx.resolve — HOST side, lexical plus realpath. Catches `..`, an absolute path, and (on Linux,
//      where a container-made link materializes in the bind mount) a symlink out of the project. It is
//      also the only check the host-side git tools have, so it earns its place regardless.
//   2. resolveRealWorkspacePath — CONTAINER side. Catches what check 1 structurally cannot: on
//      Windows + Docker Desktop a link created inside the sandbox does not appear on the NTFS side, so
//      the host sees a path that is not there and passes it, while Docker's archive endpoint follows
//      the link. The check has to run on the side the read runs on.
//
// The result is what /workspace expects — forward slashes on every host OS, no leading `./`.

import path from 'node:path';

import { messageOf } from './fs-support.js';
// Asks the container where the path really points, once every symlink on it has been followed.
import { resolveRealWorkspacePath } from './resolve-real-workspace-path.js';
import type { ToolContext } from './types.js';

export type ScopedPath =
  | { readonly ok: true; readonly relative: string }
  | { readonly ok: false; readonly error: string };

export async function scopeToWorkspace(ctx: ToolContext, relative: string): Promise<ScopedPath> {
  let scoped: string;
  try {
    const resolved = ctx.resolve(relative); // throws on an escape
    const root = ctx.resolve('.'); // the same root, realpathed the same way
    scoped = path.relative(root, resolved).split(path.sep).join('/');
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }

  const real = await resolveRealWorkspacePath(ctx.sandbox, scoped);
  if (!real.ok) {
    return real.escaped
      ? { ok: false, error: `Path '${relative}' escapes the project directory` }
      : { ok: false, error: `Path '${relative}' could not be resolved: ${real.message}` };
  }
  return { ok: true, relative: scoped };
}
