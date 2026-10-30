// Host-side project runner (V1/05). Dispatches a language toolchain command into a project's OWN
// disposable, networked container via `docker compose ... run --rm runner` — NO docker-in-docker,
// no socket exposed into the root sandbox. Distinct from SandboxClient (the shared root sandbox for
// plain shell): this spins up the per-project `runner` service the V1/07 scaffold declares, which
// carries the project's stack + network for real installs.

import { killContainer } from './kill-container.js';
import { runDocker } from './run-docker.js';
import type { DockerResult } from './run-docker.js';

/**
 * `docker compose -f <composePath> run --name <containerName> --rm runner sh -c '<command>'`.
 * The unique `--name` lets kill-on-timeout target exactly this one-off container; `--rm` disposes
 * it. On timeout, the container is killed out-of-band (killing the host process alone would leave
 * the container running).
 */
export function composeRun(
  composePath: string,
  command: string,
  timeoutMs: number,
  containerName: string,
): Promise<DockerResult> {
  // runDocker spawns the docker CLI with this argv and no host shell, and fires onTimeout before it
  // SIGKILLs the host-side process.
  return runDocker(
    ['compose', '-f', composePath, 'run', '--name', containerName, '--rm', 'runner', 'sh', '-c', command],
    timeoutMs,
    () => {
      void killContainer(containerName);
    },
  );
}
