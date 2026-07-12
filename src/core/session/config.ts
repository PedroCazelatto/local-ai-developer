// Session configuration: resolved once at boot and read-only thereafter.
//
// A session is locked to exactly ONE project for its whole lifetime — switching
// projects means restarting the process (CLAUDE.md, "How a session works"). Nothing
// downstream may mutate the active project, so every field here is `readonly`.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { loadAppState } from './app-state.js';

/**
 * The FALLBACK default model — used only when neither state.json (a prior `/models use`, V5/02) nor a
 * MODEL_NAME env var (there is none by design — model selection is a UI choice, not env) has set one.
 * Runtime resolution order: state.json's activeModel → DEFAULT_MODEL.
 * TEMPORARY (2026-07-09): a 3B model so the loop is testable on an 8 GB M2 Air (unified memory),
 * where the 14B target won't fit alongside Docker + Node + Ollama. It only needs to emit valid tool
 * calls; output quality is irrelevant for testing. Revert to 'qwen2.5-coder:14b' — the intended
 * production model — on the RTX 3060 target.
 */
export const DEFAULT_MODEL = 'qwen2.5-coder:3b';
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
  /** Boot model: state.json's activeModel (a prior `/models use`, V5/02) if present, else DEFAULT_MODEL. */
  readonly modelName: string;
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

  // run.ps1 sets $env:ACTIVE_PROJECT for docker compose; argv is the source of truth.
  // A stale env var must not silently point the sandbox at a different project.
  const activeProject = process.env.ACTIVE_PROJECT;
  if (activeProject !== undefined && activeProject !== projectName) {
    console.warn(
      `Warning: ACTIVE_PROJECT='${activeProject}' does not match session project '${projectName}'. ` +
        `Using '${projectName}' (argv wins); the sandbox mount may be stale.`,
    );
  }

  // Resolution order (task 02): persisted state.json → DEFAULT_MODEL. loadAppState never throws — a
  // missing file is normal, a corrupt one falls back with a surfaced warning — so boot can't crash here.
  const modelName = loadAppState().activeModel ?? DEFAULT_MODEL;

  return {
    projectName,
    projectPath,
    modelName,
    numCtx: resolveNumCtx(),
    summarizationThresholdRatio: resolveThresholdRatio(),
    initialPhase: DEFAULT_PHASE,
  };
}
