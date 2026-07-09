// Session configuration: resolved once at boot and read-only thereafter.
//
// A session is locked to exactly ONE project for its whole lifetime — switching
// projects means restarting the process (CLAUDE.md, "How a session works"). Nothing
// downstream may mutate the active project, so every field here is `readonly`.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Hardcoded until the V5 UI model picker; do not add a MODEL_NAME env/UI selector before then.
 * TEMPORARY (2026-07-09): a 3B model so the loop is testable on an 8 GB M2 Air (unified memory),
 * where the 14B target won't fit alongside Docker + Node + Ollama. It only needs to emit valid tool
 * calls; output quality is irrelevant for testing. Revert to 'qwen2.5-coder:14b' — the intended
 * production model — on the RTX 3060 target.
 */
export const DEFAULT_MODEL = 'qwen2.5-coder:3b';
/** num_ctx is a hard VRAM ceiling — never estimated or invented (CLAUDE.md memory model). */
export const DEFAULT_NUM_CTX = 16384;
export const DEFAULT_PHASE = 'discovery';

export interface SessionConfig {
  /** The locked <project-name> from argv (source of truth). */
  readonly projectName: string;
  /** Absolute path to projects/<name> — the same path task 04 bind-mounts as /workspace. */
  readonly projectPath: string;
  /** DEFAULT_MODEL constant for now; UI picker is V5. */
  readonly modelName: string;
  /** From OLLAMA_NUM_CTX, else DEFAULT_NUM_CTX. */
  readonly numCtx: number;
  /** Phase the session opens in. */
  readonly initialPhase: string;
}

/** Read OLLAMA_NUM_CTX, guarding against NaN / non-positive values by falling back loudly. */
function resolveNumCtx(): number {
  const raw = process.env.OLLAMA_NUM_CTX;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_NUM_CTX;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Warning: OLLAMA_NUM_CTX='${raw}' is not a positive number; using default ${DEFAULT_NUM_CTX}.`,
    );
    return DEFAULT_NUM_CTX;
  }
  return Math.floor(parsed);
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

  // run.ps1 sets $env:ACTIVE_PROJECT for docker compose; argv is the source of truth.
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
    modelName: DEFAULT_MODEL,
    numCtx: resolveNumCtx(),
    initialPhase: DEFAULT_PHASE,
  };
}
