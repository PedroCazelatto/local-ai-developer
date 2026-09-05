// The config step of the boot sequence — the one place a bad <project-name> is turned away, before
// anything expensive (a daemon call, a container, the REPL) has been started.

import { errMessage } from '../core/err-message.js';
import { config, type SessionConfig } from '../core/session/config.js';
import { fail } from './fail.js';

/** Resolve config or fail loud and early with a non-zero exit. */
export function resolveOrExit(projectName: string): SessionConfig {
  try {
    // config.loadConfig resolves the env-backed session settings and validates that the project
    // directory is really there, throwing rather than returning a half-built config when it is not.
    return config.loadConfig(projectName);
  } catch (err) {
    fail(errMessage(err));
  }
}
