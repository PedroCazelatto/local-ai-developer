#!/usr/bin/env node
// Cross-platform launcher — replaces the old run.ps1 so the entrypoint works identically on
// Windows, macOS, and Linux (Node is the guaranteed runtime; Docker is cross-platform).
// Thin wrapper over npm / docker compose: it holds NO orchestration logic of its own — all real
// behavior lives in src/ (TypeScript). Verbs: install | start <project> | stop.
//
// Usage:
//   node scripts/run.mjs install
//   node scripts/run.mjs start <project>
//   node scripts/run.mjs stop

import { spawnSync } from 'node:child_process';

const [, , action, project] = process.argv;

/**
 * Run a command with inherited stdio. `shell: true` lets `npm`/`docker` resolve via PATH on every
 * OS (on Windows npm is `npm.cmd`, which bare spawn would not find). Extra env is merged over the
 * parent's — used to pass ACTIVE_PROJECT without any shell-specific `export`/`$env:` syntax.
 */
function run(command, extraEnv = {}) {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  return result.status ?? 1;
}

function usage() {
  console.log('Available commands:');
  console.log('  install          Install Node dependencies and pull the sandbox image');
  console.log('  start <project>  Start Docker and run the orchestrator for a project');
  console.log('  stop             Stop Docker containers');
}

switch (action) {
  case 'install': {
    console.log('Installing Node dependencies...');
    run('npm install');
    // Stock image (node:24-slim, see docker-compose.yml) — pull rather than build.
    console.log('Pulling sandbox image...');
    run('docker compose pull');
    break;
  }
  case 'start': {
    if (!project) {
      console.error('Error: project name required. Example: node scripts/run.mjs start hello-world');
      process.exit(1);
    }
    try {
      console.log('Starting infrastructure...');
      // Sandbox mounts only this project at /workspace (see docker-compose.yml); ACTIVE_PROJECT selects it.
      run('docker compose up -d', { ACTIVE_PROJECT: project });
      console.log('Initializing Local AI Developer...');
      // `--` forwards the project name to `tsx src/index.ts` as argv.
      run(`npm run dev -- ${project}`, { ACTIVE_PROJECT: project });
    } finally {
      console.log('Shutting down infrastructure...');
      run('docker compose stop', { ACTIVE_PROJECT: project });
    }
    break;
  }
  case 'stop':
    run('docker compose stop');
    break;
  default:
    usage();
}
