// The one place the host-side project runner (V1/05) actually invokes Docker. Every compose call
// beside it — compose-run.ts, compose-build.ts, kill-container.ts — is an argv array handed to this
// one function, which spawns the `docker` CLI directly with NO host shell in the way.
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
export function runDocker(
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
