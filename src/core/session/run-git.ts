// runGit — the ONE way anything host-side talks to a project's git repo. Extracted from
// project-git.ts so the stash / branch / push / inspect modules share a single invocation with a
// single guarantee, instead of each re-deriving it.
//
// The guarantee: an explicit `-C <projectPath>` with an ARGV and NO SHELL. Nothing the model supplies
// is ever parsed by a shell, and every command is pinned to the project repo — the guard that keeps a
// model-driven git action from reaching the orchestrator's own rules/ (which lives outside every
// project). It also never throws: a non-zero exit comes back as `ok: false` plus git's stderr, so a
// caller can hand the model a recoverable message instead of dying mid-turn.
//
// spawnSync, NOT execFileSync, for two reasons that both come down to stderr:
//  - git reports on stderr even when it SUCCEEDS (`git push` writes "* [new branch]" and "Everything
//    up-to-date" there), and execFileSync only ever returns stdout — so a success story was
//    unreadable, which is exactly what a push has to report on.
//  - execFileSync forwards the child's stderr to the parent's stderr by default, so git's chatter
//    ("warning: LF will be replaced by CRLF...") printed straight into the REPL, over output the
//    terminal-UX rules treat as immutable scrollback. spawnSync captures it instead.

import { spawnSync } from 'node:child_process';

import type { GitRun } from './run-git.type.js';

/** Run one git command against the project repo. Never throws — a non-zero exit is captured. */
export function runGit(projectPath: string, args: readonly string[]): GitRun {
  const result = spawnSync('git', ['-C', projectPath, ...args], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // spawnSync reports a failure to START the process (git missing from PATH) on `error`, with a null
  // status — distinct from git running and exiting non-zero.
  if (result.error !== undefined) {
    return { ok: false, stdout: '', stderr: result.error.message };
  }
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: (result.stderr ?? '').trim(),
  };
}
