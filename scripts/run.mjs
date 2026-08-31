#!/usr/bin/env node
// Cross-platform launcher — replaces the old run.ps1 so the entrypoint works identically on
// Windows, macOS, and Linux (Node is the guaranteed runtime; Docker is cross-platform).
// Thin wrapper over npm / docker compose: it holds NO orchestration logic of its own — all real
// behavior lives in src/ (TypeScript). Verbs: install | start <project> | stop.
//
// It is also where the Node version is ENFORCED, because it runs before anything else and imports
// nothing: `install` and `start` refuse a runtime outside the major .nvmrc pins, and every compose
// call exports that pin as NODE_VERSION for docker-compose.yml to interpolate into the image tag.
//
// Usage:
//   node scripts/run.mjs install
//   node scripts/run.mjs start <project>
//   node scripts/run.mjs stop

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [, , action, project] = process.argv;

// Safe project directory name: no separators, no traversal, only these characters. A deliberate
// COPY of SAFE_NAME in src/interface/commands/new-project.ts, which enforces the same rule when it
// CREATES a project — this launcher stays dependency-free (plain .mjs, importing nothing from the
// TypeScript under src/), so the two copies live side by side. Change one, change the other.
//
// Note that the version below is NOT copied the same way. Duplication is the defect the version
// check exists to remove, so .nvmrc is read instead.
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

// Resolved against THIS FILE, never process.cwd(), so the launcher reads the repo's own pin whether
// npm ran it from the repo root or a user typed a path to it from somewhere else.
const NVMRC = new URL('../.nvmrc', import.meta.url);

// A pin this launcher can act on: a bare version, optionally `v`-prefixed, and nothing else. nvm
// also accepts aliases (`lts/*`, `node`, `system`); none of them names a major, so none of them can
// answer the only question asked here, and they are rejected as malformed rather than waved through.
const NVMRC_PIN = /^v?(\d+)(?:\.\d+)*$/;

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

/**
 * Read the Node version pinned in .nvmrc — the single source of truth for the version this repo
 * runs on, and the only place it is declared at all.
 *
 * Decides nothing and never exits: the caller decides what an unreadable pin means, because the two
 * gated verbs have to refuse on one where `stop` has to carry on regardless.
 *
 * @returns {{ pin: string, major: string } | { fault: string }} the pin as written (minus any `v`)
 *   together with its major, or a clause naming what is wrong with the file.
 */
function readNodePin() {
  let raw;
  try {
    raw = readFileSync(NVMRC, 'utf8');
  } catch (error) {
    return { fault: `.nvmrc could not be read (${error.code ?? error.message})` };
  }
  // One line and a trailing newline — CRLF on a Windows checkout, so trim rather than slice.
  const text = raw.trim();
  const match = NVMRC_PIN.exec(text);
  if (!match) {
    // Quote what is actually in there, so the fix is obvious — flattened and clipped, because the
    // file is only supposed to hold one short line and an unreadable one must not spill the screen.
    const seen = text.replace(/\s+/g, ' ').slice(0, 40);
    return { fault: text ? `.nvmrc does not hold a version number (it reads '${seen}')` : '.nvmrc is empty' };
  }
  return { pin: match[0].replace(/^v/, ''), major: match[1] };
}

/**
 * Refuse to go any further unless this process runs the Node MAJOR that .nvmrc pins, and hand the
 * pin back for the caller to export. Called by `install` and `start` only — `stop` is never gated,
 * because tearing the stack down has to work on any Node, and gating it would strand a user who
 * cannot bring the stack down without first switching runtimes.
 *
 * The comparison is the major and only the major: v24.1.0 passes where v22.14.0 fails. The pin says
 * which 24 the repo was developed against, not which 24 is mandatory — which is exactly why the
 * refusal names both numbers, the requirement and the pin.
 *
 * A .nvmrc that is missing or malformed refuses too, in its own words. It is the only declaration of
 * the version left in this repo, so with it unreadable there is nothing to check against — and a
 * check that cannot run must not report a pass.
 *
 * @param {{ pin: string, major: string } | { fault: string }} nvmrc
 * @returns {string} the pinned version, for NODE_VERSION
 */
function requireNodeMajor(nvmrc) {
  if (nvmrc.fault) {
    console.error(`✗ Cannot check the Node version — ${nvmrc.fault}.`);
    console.error('');
    console.error('  .nvmrc is the only place this repo declares the Node version it runs on, so there');
    console.error('  is nothing left to check against. Restore it — one version number, nothing else —');
    console.error('  and try again.');
    process.exit(1);
  }
  const found = process.versions.node;
  if (found.split('.')[0] === nvmrc.major) return nvmrc.pin;

  console.error(`✗ Node ${nvmrc.major} is required — found v${found}.`);
  console.error('');
  console.error(`  This repo pins ${nvmrc.pin} in .nvmrc. Run \`nvm use\` in this directory (or the equivalent`);
  console.error('  for your version manager) and try again.');
  process.exit(1);
}

function usage() {
  console.log('Available commands:');
  console.log('  install          Install Node dependencies and pull the sandbox image');
  console.log('  start <project>  Start Docker and run the orchestrator for a project');
  console.log('  stop             Stop Docker containers');
}

// Front of the process, before any verb runs, and committing to nothing: an unreadable pin is fatal
// to `install` and `start` (requireNodeMajor decides that) and merely absent for `stop`.
const nvmrc = readNodePin();

switch (action) {
  case 'install': {
    // Refuses before npm touches anything (#73). A node_modules built against the wrong major is
    // the state this check exists to prevent, and a warning that lets the install proceed only
    // leaves the failure for `start` to discover later.
    const nodeVersion = requireNodeMajor(nvmrc);
    console.log('Installing Node dependencies...');
    run('npm', ['install']);
    // Stock image — pull rather than build. Its tag is `node:${NODE_VERSION}-slim` in
    // docker-compose.yml, so the sandbox runs the version .nvmrc pins instead of a floating major
    // free to drift a whole minor away from it.
    console.log('Pulling sandbox image...');
    run('docker', ['compose', 'pull'], { NODE_VERSION: nodeVersion });
    break;
  }
  case 'start': {
    // The gate is the first thing the verb does, ahead of even the argument check: "start a batch
    // and walk away" is the point of this verb, so a wrong runtime has to surface now rather than
    // hours later.
    const nodeVersion = requireNodeMajor(nvmrc);
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
      // Sandbox mounts only this project at /workspace (see docker-compose.yml); ACTIVE_PROJECT
      // selects it, and NODE_VERSION is the tag its image is resolved from.
      run('docker', ['compose', 'up', '-d'], { ACTIVE_PROJECT: project, NODE_VERSION: nodeVersion });
      console.log('Initializing Local AI Developer...');
      // `--` forwards the project name to `tsx src/index.ts` as argv.
      run('npm', ['run', 'dev', '--', project], { ACTIVE_PROJECT: project });
    } finally {
      console.log('Shutting down infrastructure...');
      run('docker', ['compose', 'stop'], { ACTIVE_PROJECT: project, NODE_VERSION: nodeVersion });
    }
    break;
  }
  case 'stop':
    // NEVER gated (#73): shutting Docker down has to work on any Node — including one this launcher
    // would refuse to start on — and on a .nvmrc it cannot read at all. The pin is passed when there
    // is one and simply left out when there is not, because `stop` matches running containers by
    // name and the tag compose would resolve never enters into it.
    run('docker', ['compose', 'stop'], nvmrc.pin ? { NODE_VERSION: nvmrc.pin } : {});
    break;
  default:
    usage();
}
