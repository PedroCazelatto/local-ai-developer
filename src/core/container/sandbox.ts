// SandboxClient — the model's ONLY hand into the world. Every command the model runs and every
// file it edits happens inside this container; the orchestrator is the only host-side process
// (CLAUDE.md, "Sandboxing & tools"). Port of core/container/client.py (Docker exec via the
// Python SDK) onto dockerode, plus the ROADMAP pivot: the sandbox is now NETWORKED + hardened
// (rootless, capped) so projects can `npm i` / `pip install`, reversing the old network_mode:none.
//
// The whole security model is the mount boundary: only the active project is bind-mounted at
// /workspace, so `..` / `$(...)` / symlinks inside a command cannot escape a container that
// simply never had the host mounted. Do not add more mounts.
//
// TWO channels, both landing inside that mount:
//   - `exec` — a shell command, for the tools whose whole job is a command (execute_command) and
//     for the two inspection tools that are a directory walk (list_files, search_in_files).
//   - `readWorkspaceFile` / `writeWorkspaceFile` — EXACT BYTES over Docker's archive endpoints, for
//     read_file / write_file / edit_file. Deliberately not a shell command: file content would
//     otherwise have to survive `sh -c` quoting, and a tar stream has no quoting rules to get wrong
//     and no argv length ceiling.

import { Writable } from 'node:stream';

import Docker from 'dockerode';

import { decodeTarFile } from './decode-tar-file.js';
import { encodeTar } from './encode-tar.js';
import type { SandboxRead, SandboxWrite } from './sandbox-file.type.js';
import type { TarEntry } from './tar-entry.type.js';

/** The long-lived root sandbox container (created by `docker compose up -d`). */
export const SANDBOX_CONTAINER = 'ai_sandbox';

/** Where the active project is bind-mounted. The project root IS this path — nothing above it exists. */
const WORKSPACE = '/workspace';

/** node:<lts>-slim, not debian: V1's project work + `npm i` need node/npm in the box already. */
const DEFAULT_IMAGE = 'node:24-slim';
/** Ported from the old compose caps: cpus '2.0' → 2 CPUs in nano-units. */
const DEFAULT_NANO_CPUS = 2_000_000_000;
/** Ported from the old compose caps: memory 4gb. */
const DEFAULT_MEMORY_BYTES = 4 * 1024 ** 3;

export interface ExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SandboxOptions {
  /** Container name to attach to — normally SANDBOX_CONTAINER. */
  readonly containerName: string;
  /** Absolute host path bind-mounted at /workspace. THE security boundary — only this is mounted. */
  readonly projectPath: string;
  /** Override the image for the fallback create path (default node:24-slim). */
  readonly image?: string;
  readonly nanoCpus?: number;
  readonly memoryBytes?: number;
}

interface ExecOptions {
  readonly workdir?: string;
  readonly timeoutMs?: number;
}

/** dockerode/docker HTTP errors carry a numeric statusCode; narrow without asserting `any`. */
function statusCodeOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const code = (err as { statusCode: unknown }).statusCode;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class SandboxClient {
  private readonly docker: Docker;
  private readonly containerName: string;
  private readonly projectPath: string;
  private readonly image: string;
  private readonly nanoCpus: number;
  private readonly memoryBytes: number;

  constructor(opts: SandboxOptions) {
    // No options → docker-modem picks the platform default socket (npipe on Windows,
    // /var/run/docker.sock elsewhere). Ollama runs on the host GPU, never here.
    this.docker = new Docker();
    this.containerName = opts.containerName;
    this.projectPath = opts.projectPath;
    this.image = opts.image ?? DEFAULT_IMAGE;
    this.nanoCpus = opts.nanoCpus ?? DEFAULT_NANO_CPUS;
    this.memoryBytes = opts.memoryBytes ?? DEFAULT_MEMORY_BYTES;
  }

  /**
   * Ensure the root sandbox is up. `run.mjs start` already does `docker compose up -d`, so the
   * common path is "container exists and runs → just attach". Idempotent: start it if stopped,
   * create it from the image if missing (fallback for a compose-less boot). Fails loud at boot
   * (this is not a per-turn call) rather than returning a recoverable error like `exec`.
   */
  async ensureStarted(): Promise<void> {
    const container = this.docker.getContainer(this.containerName);
    try {
      const info = await container.inspect();
      if (!info.State.Running) {
        await container.start();
      }
      return;
    } catch (err) {
      if (statusCodeOf(err) !== 404) throw err;
    }
    await this.createAndStart();
  }

  /** Stop the container (matches `run.mjs stop`). Does NOT remove it — persistent so deps survive. */
  async stop(): Promise<void> {
    const container = this.docker.getContainer(this.containerName);
    try {
      await container.stop();
    } catch (err) {
      const code = statusCodeOf(err);
      // 304 already stopped, 404 never existed — both are no-ops, not failures.
      if (code !== 304 && code !== 404) throw err;
    }
  }

  /**
   * Run a shell command at /workspace (default), capturing stdout, stderr, and exitCode
   * SEPARATELY (dockerode multiplexes both onto one stream without a TTY; demuxStream splits
   * them — the Python `demux=True` equivalent). RECOVERABLE: a failed command / missing
   * container / exec error returns an ExecResult with the error in stderr and a non-zero code,
   * it never throws (throwing would kill the model's turn). Ports client.py's try/except.
   */
  async exec(command: string, opts: ExecOptions = {}): Promise<ExecResult> {
    const workdir = opts.workdir ?? WORKSPACE;
    try {
      const container = this.docker.getContainer(this.containerName);
      const exec = await container.exec({
        Cmd: ['sh', '-c', command],
        WorkingDir: workdir,
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({});

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      const sink = (chunks: Buffer[]): Writable =>
        new Writable({
          write(chunk: Buffer, _enc, cb): void {
            chunks.push(Buffer.from(chunk));
            cb();
          },
        });
      this.docker.modem.demuxStream(stream, sink(stdoutChunks), sink(stderrChunks));

      const finished = await this.awaitStreamEnd(stream, opts.timeoutMs);
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      if (!finished) {
        // 124 is the conventional timeout exit code; the underlying exec is left to finish/die.
        return { exitCode: 124, stdout, stderr: `${stderr}[command timed out after ${opts.timeoutMs}ms]` };
      }

      // Exit code lives on the exec inspection, not the stream (Python read exit_code likewise).
      const info = await exec.inspect();
      return { exitCode: info.ExitCode ?? -1, stdout, stderr };
    } catch (err) {
      // Container-not-found, image error, exec failure → structured, recoverable result.
      return { exitCode: 1, stdout: '', stderr: messageOf(err) };
    }
  }

  /**
   * Read one file out of /workspace as exact bytes, via Docker's archive endpoint. `relative` is
   * project-root-relative and posix-separated; the CALLER has already scoped it (tools/context.ts's
   * resolveInProject), so this method only transports.
   *
   * Recoverable in the same way `exec` is — a missing path comes back as `{ ok: false, notFound:
   * true }`, a dead daemon as `{ ok: false, notFound: false }`, and neither throws.
   */
  async readWorkspaceFile(relative: string): Promise<SandboxRead> {
    try {
      const container = this.docker.getContainer(this.containerName);
      const stream = await container.getArchive({ path: `${WORKSPACE}/${relative}` });
      const archive = await this.drain(stream);
      // Docker answers a single-path request with a one-entry tar; decodeTarFile walks any GNU/PAX
      // metadata members and returns that entry's bytes, or reports that it was a directory.
      const member = decodeTarFile(archive);
      if (member.kind === 'directory') return { ok: true, kind: 'directory' };
      if (member.kind === 'empty') return { ok: false, notFound: true, message: 'no such file' };
      return { ok: true, kind: 'file', bytes: member.bytes };
    } catch (err) {
      const notFound = statusCodeOf(err) === 404;
      return { ok: false, notFound, message: messageOf(err) };
    }
  }

  /**
   * Write one file into /workspace as exact bytes, creating its parent chain. `relative` is
   * project-root-relative and posix-separated, already scoped by the caller.
   *
   * The archive is extracted AT /workspace and carries a directory member for every ancestor, which
   * is what replaces the old host-side `mkdirSync(dirname, { recursive: true })` — write_file must
   * still scaffold `src/foo/bar.ts` into an empty project.
   */
  async writeWorkspaceFile(relative: string, bytes: Uint8Array): Promise<SandboxWrite> {
    const segments = relative.split('/').filter((segment) => segment !== '');
    const entries: TarEntry[] = [];
    for (let i = 0; i < segments.length - 1; i += 1) {
      entries.push({ path: segments.slice(0, i + 1).join('/'), kind: 'directory' });
    }
    entries.push({ path: segments.join('/'), kind: 'file', bytes });

    try {
      const container = this.docker.getContainer(this.containerName);
      // Docker's PUT /archive extracts before it answers, so awaiting the request IS awaiting the
      // write. What it resolves to is not a readable stream (unlike getArchive) and must not be
      // drained — doing so turned every successful write into a reported failure.
      await container.putArchive(encodeTar(entries), { path: WORKSPACE });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: messageOf(err) };
    }
  }

  /** Collect a readable stream into one Buffer. */
  private drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /** Resolve true on stream `end`, false on timeout; reject on stream error. */
  private awaitStreamEnd(stream: NodeJS.ReadableStream, timeoutMs?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      const settle = (value: boolean): void => {
        if (timer) clearTimeout(timer);
        resolve(value);
      };
      stream.on('end', () => settle(true));
      stream.on('error', (e) => {
        if (timer) clearTimeout(timer);
        reject(e);
      });
      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => settle(false), timeoutMs);
      }
    });
  }

  /**
   * Fallback create path when compose has not made the container. Replicates the compose service:
   * rootless `node` user, /workspace workdir, ONLY the active project mounted, CPU/RAM caps, and a
   * long-lived non-bash command (node:slim has no interactive bash). Persistent, not --rm-per-call,
   * so installed deps survive within a session (recommended ROADMAP lifecycle resolution).
   */
  private async createAndStart(): Promise<void> {
    await this.pullImage();
    const container = await this.docker.createContainer({
      Image: this.image,
      name: this.containerName,
      User: 'node',
      WorkingDir: '/workspace',
      Cmd: ['sleep', 'infinity'],
      Tty: false,
      OpenStdin: true,
      HostConfig: {
        // The mount boundary IS the security model: only projectPath, never the host or ./projects.
        Binds: [`${this.projectPath}:/workspace`],
        NanoCpus: this.nanoCpus,
        Memory: this.memoryBytes,
      },
    });
    await container.start();
  }

  /** Pull the image (a no-op fast check if already present) so the fallback create actually works. */
  private async pullImage(): Promise<void> {
    const stream = await this.docker.pull(this.image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });
  }
}
