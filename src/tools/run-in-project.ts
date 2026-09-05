// run_in_project (V1/05) — runs a LANGUAGE-SPECIFIC command (npm i, npm test, pytest, cargo build)
// inside the project's OWN disposable, NETWORKED container (the `runner` service the V1/07 scaffold
// declares). This is where real installs happen — the air-gap is gone (the pivot). Clearly distinct
// from execute_command: that runs plain shell in the shared root sandbox; THIS runs toolchain
// commands with network in a per-call `--rm` container. Returns { exit_status, stdout, stderr,
// duration_ms }.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { composeBuild } from '../core/container/compose-build.js';
import { composeRun } from '../core/container/compose-run.js';
import { isDaemonError } from '../core/container/is-daemon-error.js';
import { truncateHeadTail } from './truncate.js';
import type { JsonObject, ToolAuditExtra, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

const DEFAULT_TIMEOUT_S = 120;
// npm/pip output is verbose — a larger per-stream cap than the plain-shell tool, still head+tail.
const RUN_OUTPUT_LIMIT = 50_000;

/** Does the compose file declare a `build:` for a service (a Dockerfile-based runner)? */
function composeDeclaresBuild(composePath: string): boolean {
  try {
    return /^\s*build:/m.test(readFileSync(composePath, 'utf-8'));
  } catch {
    return false;
  }
}

function uniqueContainerName(project: string): string {
  const safe = project.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `lad_${safe}_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const runInProjectTool: ToolModule = {
  name: 'run_in_project',
  description:
    'Run a language-specific command (test, build, lint, install — e.g. `npm i`, `npm test`, `pytest`, `cargo build`) inside the project\'s own networked container. Returns exit_status, stdout, stderr, duration_ms. For plain shell (ls, cat, mv), use execute_command instead.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The toolchain command to run, e.g. "npm test".' },
      timeout_s: {
        type: 'number',
        description: 'Max seconds before the container is killed (default 120).',
        default: DEFAULT_TIMEOUT_S,
      },
    },
    required: ['command'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const command = args['command'];
    if (typeof command !== 'string') {
      return toolError("'command' must be a string.");
    }
    let timeoutS = DEFAULT_TIMEOUT_S;
    const rawTimeout = args['timeout_s'];
    if (rawTimeout !== undefined) {
      if (typeof rawTimeout !== 'number' || !Number.isFinite(rawTimeout) || rawTimeout <= 0) {
        return toolError("'timeout_s' must be a positive number.");
      }
      timeoutS = rawTimeout;
    }

    const composePath = path.join(ctx.projectPath, 'docker-compose.yml');
    if (!existsSync(composePath)) {
      return toolError(
        `No docker-compose.yml in project '${ctx.projectName}'.`,
        'Scaffold one with /new-project <name> <stack>.',
      );
    }

    const extras: ToolAuditExtra[] = [];

    // Auto-build for a Dockerfile-based runner (image-only services build-if-absent during `run`,
    // so this only fires when the compose actually declares `build:`). Logged as its own row.
    if (composeDeclaresBuild(composePath)) {
      const build = await composeBuild(composePath);
      extras.push({
        tool: 'run_in_project',
        args: { command: 'docker compose build runner' },
        exitStatus: build.exitCode,
        durationMs: build.durationMs,
        output: truncateHeadTail(`STDOUT: ${build.stdout}\nSTDERR: ${build.stderr}`, RUN_OUTPUT_LIMIT),
        error: build.exitCode === 0 ? null : 'build failed',
        metadata: { step: 'build' },
        // The build gets its own `←` line, printed above the run's. It has no `→` line of its own
        // because the model never asked for it — but a failing build is the most likely reason a test
        // run "did nothing", and today it is invisible from the outside.
        display: { summary: `build exit ${build.exitCode}` },
      });
      if (isDaemonError(build.stderr)) {
        return { content: { error: 'Docker daemon unreachable.' }, exitStatus: -1, error: 'Docker daemon unreachable.', auditExtras: extras };
      }
      if (build.exitCode !== 0) {
        const message = `Build failed for project '${ctx.projectName}'.`;
        return {
          content: { error: message, stderr: truncateHeadTail(build.stderr, RUN_OUTPUT_LIMIT) },
          exitStatus: -1,
          error: message,
          auditExtras: extras,
        };
      }
    }

    const containerName = uniqueContainerName(ctx.projectName);
    const run = await composeRun(composePath, command, timeoutS * 1000, containerName);
    const metadata: JsonObject = { service: 'runner', timeout_s: timeoutS };

    if (isDaemonError(run.stderr) && run.stdout === '') {
      return { content: { error: 'Docker daemon unreachable.' }, exitStatus: -1, error: 'Docker daemon unreachable.', metadata, auditExtras: extras };
    }

    if (run.timedOut) {
      const stderr = `${truncateHeadTail(run.stderr, RUN_OUTPUT_LIMIT)}\n[run_in_project timed out after ${timeoutS}s; container killed]`;
      const payload: JsonObject = {
        exit_status: -1,
        stdout: truncateHeadTail(run.stdout, RUN_OUTPUT_LIMIT),
        stderr,
        duration_ms: run.durationMs,
      };
      return {
        content: payload,
        exitStatus: -1,
        error: `timed out after ${timeoutS}s`,
        metadata,
        auditExtras: extras,
        display: { summary: `timed out after ${timeoutS}s` },
      };
    }

    const payload: JsonObject = {
      exit_status: run.exitCode,
      stdout: truncateHeadTail(run.stdout, RUN_OUTPUT_LIMIT),
      stderr: truncateHeadTail(run.stderr, RUN_OUTPUT_LIMIT),
      duration_ms: run.durationMs,
    };
    return { content: payload, exitStatus: run.exitCode, metadata, auditExtras: extras, display: { summary: `exit ${run.exitCode}` } };
  },
};
