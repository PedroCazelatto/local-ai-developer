// Timeout cleanup for the host-side project runner (V1/05). Killing the host `docker compose run`
// process is not enough — the one-off container it started keeps running — so compose-run.ts kills
// the container by the unique `--name` it gave it.

import { runDocker } from './run-docker.js';
import type { DockerResult } from './run-docker.js';

/** Best-effort `docker kill <name>` (the run's `--rm` then removes the dead container). */
export function killContainer(name: string): Promise<DockerResult> {
  // runDocker spawns the docker CLI with this argv and no host shell, capped at 15s.
  return runDocker(['kill', name], 15_000);
}
