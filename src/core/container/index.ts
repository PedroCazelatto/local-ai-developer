// core/container/ — dockerode client for the hardened, networked root sandbox, plus the host-side
// project runner (V1/05) that dispatches toolchain commands into a project's own `runner` container.
// The model touches ONLY these containers, never the host filesystem (Foundation task 04).
export { SandboxClient, SANDBOX_CONTAINER } from './sandbox.js';
export type { ExecResult, SandboxOptions } from './sandbox.js';
// The file tools' byte transport — exact bytes in and out of /workspace over Docker's archive
// endpoints, so no file content ever passes through `sh -c`. One function per file: encodeTar and
// decodeTarFile are the two ends, over the ustar helpers and the shared widths in tar-format.ts.
// TarEntry is its own module (no function owns it); the two result types belong to the SandboxClient
// methods that return them, so they come from sandbox.js beside ExecResult.
export type { TarEntry } from './tar-entry.type.js';
export type { SandboxRead, SandboxWrite } from './sandbox.js';
export { encodeTar } from './encode-tar.js';
export { decodeTarFile } from './decode-tar-file.js';
export type { TarFileRead } from './decode-tar-file.js';
// The per-project runner, one function per file over the single `docker` CLI spawn in run-docker.ts.
export { composeRun } from './compose-run.js';
export { composeBuild } from './compose-build.js';
export { killContainer } from './kill-container.js';
export { isDaemonError } from './is-daemon-error.js';
export type { DockerResult } from './run-docker.js';
