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

// Safe project directory name: no separators, no traversal, only these characters. A deliberate
// COPY of SAFE_NAME in src/interface/commands/new-project.ts, which enforces the same rule when it
// CREATES a project — this launcher stays dependency-free (plain .mjs, importing nothing from the
// TypeScript under src/), so the two copies live side by side. Change one, change the other.
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * Run a command as an argv ARRAY with inherited stdio — never a formatted string, so no argument
 * can be re-parsed as syntax on its way to the child. Extra env is merged over the parent's, which
 * is how ACTIVE_PROJECT travels without any shell-specific `export` / `$env:` syntax.
 *
 * `shell` is a measured platform fact, not a style choice. POSIX needs none at all, and on Windows
 * `docker` is `docker.exe` and spawns fine without one — but `npm` is `npm.cmd`, a batch file, and
 * there bare `npm` fails ENOENT while `npm.cmd` fails EINVAL, because Node refuses to spawn
 * .bat/.cmd without a shell. So npm-on-Windows is the one child that still needs it, and there the
 * argv array is joined back into a command line: the containment for that case is the SAFE_NAME
 * check in `start`, which runs before any project name reaches this function.
 */
function run(file, args, extraEnv = {}) {
  const result = spawnSync(file, args, {
    stdio: 'inherit',
    shell: file === 'npm' && process.platform === 'win32',
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
    run('npm', ['install']);
    // Stock image (node:24-slim, see docker-compose.yml) — pull rather than build.
    console.log('Pulling sandbox image...');
    run('docker', ['compose', 'pull']);
    break;
  }
  case 'start': {
    if (!project) {
      console.error('Error: project name required. Example: node scripts/run.mjs start hello-world');
      process.exit(1);
    }
    // The name is both a directory name and the value compose interpolates into the sandbox mount
    // (`./projects/${ACTIVE_PROJECT}:/workspace`), so `..` in it would mount a directory from
    // OUTSIDE projects/ at /workspace and undo the isolation that mount exists for. Reject anything
    // that could never be a project directory, by the same rule /new-project applies when it makes one.
    if (project === '.' || project === '..' || !SAFE_NAME.test(project)) {
      console.error(`Error: invalid project name '${project}'. Use letters, digits, '.', '_', '-' only.`);
      process.exit(1);
    }
    try {
      console.log('Starting infrastructure...');
      // Sandbox mounts only this project at /workspace (see docker-compose.yml); ACTIVE_PROJECT selects it.
      run('docker', ['compose', 'up', '-d'], { ACTIVE_PROJECT: project });
      console.log('Initializing Local AI Developer...');
      // `--` forwards the project name to `tsx src/index.ts` as argv.
      run('npm', ['run', 'dev', '--', project], { ACTIVE_PROJECT: project });
    } finally {
      console.log('Shutting down infrastructure...');
      run('docker', ['compose', 'stop'], { ACTIVE_PROJECT: project });
    }
    break;
  }
  case 'stop':
    run('docker', ['compose', 'stop']);
    break;
  default:
    usage();
}
