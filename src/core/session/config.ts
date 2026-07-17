// Session configuration: resolved once at boot and read-only thereafter.
//
// A session is locked to exactly ONE project for its whole lifetime — switching
// projects means restarting the process (CLAUDE.md, "How a session works"). Nothing
// downstream may mutate the active project, so every field here is `readonly`.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * The model we SUGGEST DOWNLOADING when Ollama has nothing installed at all — a starting point for a
 * fresh machine, never a value the session silently boots on. It was formerly DEFAULT_MODEL, the boot
 * fallback, which was the bug: a hard-coded name says nothing about what is actually pulled, so a fresh
 * install booted locked to a model that did not exist and every turn failed. The boot model now comes
 * from the installed set (resolve-boot-model.ts); this name only ever reaches the user as an offer.
 * A 3B is deliberate for the suggestion: it is the least likely first download to not fit.
 */
export const SUGGESTED_MODEL = 'qwen2.5-coder:3b';
/** num_ctx is a hard VRAM ceiling — never estimated or invented (CLAUDE.md memory model). */
export const DEFAULT_NUM_CTX = 16384;
export const DEFAULT_PHASE = 'discovery';
/**
 * Summarization failsafe trigger (V4/05): compact a phase once its EXACT prompt_eval_count reaches
 * this fraction of num_ctx. 0.75 leaves headroom for the next response + tool-result payloads.
 */
export const DEFAULT_SUMMARIZATION_THRESHOLD_RATIO = 0.75;

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
 * Read SUMMARIZATION_THRESHOLD_RATIO, guarding NaN / a value outside (0, 1] by falling back loudly.
 * A ratio ≤ 0 never leaves headroom, and a ratio > 1 would let a phase blow past num_ctx before the
 * failsafe fires — both defeat the VRAM safety it exists for, so reject them and use the default.
 */
function resolveThresholdRatio(): number {
  const raw = process.env.SUMMARIZATION_THRESHOLD_RATIO;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_SUMMARIZATION_THRESHOLD_RATIO;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    console.warn(
      `Warning: SUMMARIZATION_THRESHOLD_RATIO='${raw}' is not a number in (0, 1]; ` +
        `using default ${DEFAULT_SUMMARIZATION_THRESHOLD_RATIO}.`,
    );
    return DEFAULT_SUMMARIZATION_THRESHOLD_RATIO;
  }
  return parsed;
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
    numCtx: resolveNumCtx(),
    summarizationThresholdRatio: resolveThresholdRatio(),
    initialPhase: DEFAULT_PHASE,
  };
}
