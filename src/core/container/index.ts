// core/container/ — dockerode client for the hardened, networked sandbox container.
// The model touches ONLY this container, never the host filesystem (Foundation task 04).
export { SandboxClient, SANDBOX_CONTAINER } from './sandbox.js';
export type { ExecResult, SandboxOptions } from './sandbox.js';
