// Host-side project runner (V1/05). Dispatches language toolchain commands into a project's OWN
// disposable, networked container via `docker compose ... run --rm runner` — NO docker-in-docker,
// no socket exposed into the root sandbox. Distinct from SandboxClient (the shared root sandbox for
// plain shell): this spins up the per-project `runner` service the V1/07 scaffold declares, which
// carries the project's stack + network for real installs.
//
// The command runs from the HOST (the orchestrator owns the host); the container is where the model
// "acts" — the model never invokes Docker itself.

import { spawn } from 'node:child_process';

export interface DockerResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

/** Run the `docker` CLI with an argv array (no host shell — the command reaches `sh -c` in the container). */
function runDocker(
  args: readonly string[],
  timeoutMs: number | undefined,
  onTimeout?: () => void,
): Promise<DockerResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const child = spawn('docker', [...args], { windowsHide: true });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (exitCode: number, extraStderr = ''): void => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode,
        stdout: Buffer.concat(outChunks).toString('utf-8'),
        stderr: Buffer.concat(errChunks).toString('utf-8') + extraStderr,
        timedOut,
        durationMs: Math.round(performance.now() - start),
      });
    };

    child.stdout.on('data', (d: Buffer) => outChunks.push(Buffer.from(d)));
    child.stderr.on('data', (d: Buffer) => errChunks.push(Buffer.from(d)));
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        onTimeout?.();
        child.kill('SIGKILL');
      }, timeoutMs);
    }
    child.on('close', (code) => finish(code ?? -1));
    // spawn error (e.g. docker binary missing) — recoverable, surfaced in stderr.
    child.on('error', (err) => finish(-1, `\n${err instanceof Error ? err.message : String(err)}`));
  });
}

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
  return runDocker(
    ['compose', '-f', composePath, 'run', '--name', containerName, '--rm', 'runner', 'sh', '-c', command],
    timeoutMs,
    () => {
      void killContainer(containerName);
    },
  );
}

/** `docker compose -f <composePath> build runner` — used when the runner service declares `build:`. */
export function composeBuild(composePath: string): Promise<DockerResult> {
  return runDocker(['compose', '-f', composePath, 'build', 'runner'], undefined);
}

/** Best-effort `docker kill <name>` (the run's `--rm` then removes the dead container). */
export function killContainer(name: string): Promise<DockerResult> {
  return runDocker(['kill', name], 15_000);
}

/** Docker daemon / CLI connectivity failure, so the model doesn't retry uselessly. */
export function isDaemonError(stderr: string): boolean {
  return (
    stderr.includes('Cannot connect to the Docker daemon') ||
    stderr.includes('error during connect') ||
    stderr.includes('The system cannot find the file specified') ||
    stderr.includes('docker daemon is not running')
  );
}
