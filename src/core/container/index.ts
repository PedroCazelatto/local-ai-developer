// core/container/ — dockerode client for the hardened, networked root sandbox, plus the host-side
// project runner (V1/05) that dispatches toolchain commands into a project's own `runner` container.
// The model touches ONLY these containers, never the host filesystem (Foundation task 04).
export { SandboxClient, SANDBOX_CONTAINER } from './sandbox.js';
export type { ExecResult, SandboxOptions } from './sandbox.js';
// The file tools' byte transport — exact bytes in and out of /workspace over Docker's archive
// endpoints, so no file content ever passes through `sh -c`.
export type { SandboxRead, SandboxWrite } from './sandbox-file.type.js';
export { encodeTar } from './encode-tar.js';
export { decodeTarFile } from './decode-tar-file.js';
export type { TarEntry } from './tar-entry.type.js';
export type { TarFileRead } from './decode-tar-file.type.js';
export { composeRun, composeBuild, killContainer, isDaemonError } from './project-runner.js';
export type { DockerResult } from './project-runner.js';
