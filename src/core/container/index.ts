// core/container/ — dockerode client for the hardened, networked root sandbox, plus the host-side
// project runner (V1/05) that dispatches toolchain commands into a project's own `runner` container.
// The model touches ONLY these containers, never the host filesystem (Foundation task 04).
export { SandboxClient, SANDBOX_CONTAINER } from './sandbox.js';
export type { ExecResult, SandboxOptions } from './sandbox.js';
export { composeRun, composeBuild, killContainer, isDaemonError } from './project-runner.js';
export type { DockerResult } from './project-runner.js';
