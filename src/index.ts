// CLI / REPL entry point.
//
// Boot sequence (Foundation task 02): load .env, parse the required <project-name> argv,
// resolve + validate the session config, then hand it to the orchestrator + REPL (wired in
// tasks 05/06). Until those exist, printing the resolved config and exiting cleanly is enough.
//
// `import 'dotenv/config'` MUST come before any process.env read, or OLLAMA_NUM_CTX is
// undefined on first read.
import 'dotenv/config';

import { loadConfig, type SessionConfig } from './core/session/index.js';

/** Resolve config or fail loud and early with a non-zero exit. */
function resolveOrExit(projectName: string): SessionConfig {
  try {
    return loadConfig(projectName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

function main(): void {
  const projectName = process.argv[2];
  if (projectName === undefined || projectName.trim() === '') {
    // Usage mirrors the user-facing run.ps1 verb, not `node ...`.
    console.error('Usage: run start <project-name>');
    process.exit(1);
  }

  const config = resolveOrExit(projectName);

  // TODO(05/06): boot the orchestrator + persistent REPL with this config.
  console.log('local-ai-developer — session config resolved:');
  console.log(`  project:  ${config.projectName}`);
  console.log(`  path:     ${config.projectPath}`);
  console.log(`  model:    ${config.modelName}`);
  console.log(`  num_ctx:  ${config.numCtx}`);
  console.log(`  phase:    ${config.initialPhase}`);
}

main();
