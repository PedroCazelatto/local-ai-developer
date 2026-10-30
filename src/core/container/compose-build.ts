// The build step of the host-side project runner (V1/05) — only needed by a project whose `runner`
// service is Dockerfile-based rather than a plain image. Untimed on purpose: a first image build
// legitimately takes minutes, and the caller (tools/run-in-project.ts) decides what to do with it.

import { runDocker } from './run-docker.js';
import type { DockerResult } from './run-docker.js';

/** `docker compose -f <composePath> build runner` — used when the runner service declares `build:`. */
export function composeBuild(composePath: string): Promise<DockerResult> {
  // runDocker spawns the docker CLI with this argv and no host shell; `undefined` means no timeout.
  return runDocker(['compose', '-f', composePath, 'build', 'runner'], undefined);
}
