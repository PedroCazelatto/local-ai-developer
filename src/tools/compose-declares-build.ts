// Does a project's compose file declare a `build:` for a service — i.e. is its runner built from a
// Dockerfile rather than pulled as an image?
//
// It exists to decide whether run_in_project should build BEFORE it runs. An image-only service
// builds-if-absent during `run`, so an unconditional build would be a wasted step on every call;
// a Dockerfile-based one would otherwise run against a stale image.
//
// A read failure is `false`, not a throw: a missing or unreadable compose file is the caller's
// problem to report (it checks existence itself, with a message naming /new-project), and this
// function's only job is the build question.

import { readFileSync } from 'node:fs';

/** Does the compose file declare a `build:` for a service (a Dockerfile-based runner)? */
export function composeDeclaresBuild(composePath: string): boolean {
  try {
    return /^\s*build:/m.test(readFileSync(composePath, 'utf-8'));
  } catch {
    return false;
  }
}
