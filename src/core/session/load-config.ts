// The session config assembly — the entry point config.ts re-exports, and the shape it produces.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_EVICTION_THRESHOLD_RATIO,
  DEFAULT_PHASE,
  DEFAULT_SUMMARIZATION_THRESHOLD_RATIO,
} from './config.js';
import { resolveNumCtx } from './resolve-num-ctx.js';
import { resolveRatio } from './resolve-ratio.js';
import { resolveTimeoutMs } from './resolve-timeout-ms.js';

/**
 * Session configuration: resolved once at boot and read-only thereafter.
 *
 * A session is locked to exactly ONE project for its whole lifetime — switching
 * projects means restarting the process (CLAUDE.md, "How a session works"). Nothing
 * downstream may mutate the active project, so every field here is `readonly`.
 */
export interface SessionConfig {
  /** The locked <project-name> from argv (source of truth). */
  readonly projectName: string;
  /** Absolute path to projects/<name> — the same path task 04 bind-mounts as /workspace. */
  readonly projectPath: string;
  // No modelName here by design: unlike everything else in this file, the model is neither static for the
  // session's lifetime (`/models use` switches it live) nor knowable without asking the Ollama daemon what
  // is installed. It is resolved separately at boot (resolve-boot-model.ts) and owned by OllamaClient
  // thereafter — `orch.model` is the single source of truth for which model turns go to.
  /** From OLLAMA_NUM_CTX, else DEFAULT_NUM_CTX. */
  readonly numCtx: number;
  /**
   * From SUMMARIZATION_THRESHOLD_RATIO (a value in (0, 1]), else
   * DEFAULT_SUMMARIZATION_THRESHOLD_RATIO. The failsafe (V4/05) compacts a phase when its exact
   * prompt_eval_count ≥ this ratio × numCtx.
   */
  readonly summarizationThresholdRatio: number;
  /**
   * From EVICTION_THRESHOLD_RATIO (a value in (0, 1]), else DEFAULT_EVICTION_THRESHOLD_RATIO. A spawned
   * window stubs its older tool results when its exact prompt_eval_count ≥ this ratio × numCtx.
   */
  readonly evictionThresholdRatio: number;
  /** From OLLAMA_TIMEOUT_MS, else DEFAULT_TIMEOUT_MS — the per-call stall window (see the constant). */
  readonly timeoutMs: number;
  /** Phase the session opens in. */
  readonly initialPhase: string;
}

/**
 * Resolve and validate the session config for `projectName`. Throws a clear Error if the
 * project folder is missing — the caller prints it and exits non-zero (fail loud and early,
 * never proceed toward starting a container against a non-existent path).
 */
export function loadConfig(projectName: string): SessionConfig {
  const projectPath = path.resolve(process.cwd(), 'projects', projectName);

  if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
    throw new Error(
      `project '${projectName}' not found at projects/${projectName}/. Create it first.`,
    );
  }

  // The launcher (scripts/run.mjs) sets ACTIVE_PROJECT for docker compose; argv is the source of truth.
  // A stale env var must not silently point the sandbox at a different project.
  const activeProject = process.env.ACTIVE_PROJECT;
  if (activeProject !== undefined && activeProject !== projectName) {
    console.warn(
      `Warning: ACTIVE_PROJECT='${activeProject}' does not match session project '${projectName}'. ` +
        `Using '${projectName}' (argv wins); the sandbox mount may be stale.`,
    );
  }

  return {
    projectName,
    projectPath,
    // Each resolver reads ONE env var and falls back loudly to its DEFAULT_* when the value is absent or
    // out of range — a bad env var never silently becomes a VRAM-unsafe ceiling.
    numCtx: resolveNumCtx(),
    // resolveRatio validates a fraction in (0, 1]; both context-pressure triggers share it.
    summarizationThresholdRatio: resolveRatio(
      'SUMMARIZATION_THRESHOLD_RATIO',
      DEFAULT_SUMMARIZATION_THRESHOLD_RATIO,
    ),
    evictionThresholdRatio: resolveRatio('EVICTION_THRESHOLD_RATIO', DEFAULT_EVICTION_THRESHOLD_RATIO),
    // The per-call STALL window, not a cap on turn length — see DEFAULT_TIMEOUT_MS in config.ts.
    timeoutMs: resolveTimeoutMs(),
    initialPhase: DEFAULT_PHASE,
  };
}
