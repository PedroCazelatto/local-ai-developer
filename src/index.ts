// CLI / REPL entry point.
//
// Boot sequence: load .env, parse the required <project-name> argv, resolve + validate the
// session config (02), resolve the model against what Ollama actually has installed, ensure the
// sandbox container is up (04), build the orchestrator (06), and hand it to the persistent REPL (05).
// Streams turns with exact token counts, switches phases with isolated histories, and dispatches model
// tool calls into the sandbox — the Foundation bar.
//
// `import 'dotenv/config'` MUST come before any process.env read, or OLLAMA_NUM_CTX is undefined.
import 'dotenv/config';

import { SANDBOX_CONTAINER, SandboxClient } from './core/container/index.js';
import { OllamaClient } from './core/llm/index.js';
import { SessionOrchestrator, loadConfig, resolveBootModel, type SessionConfig } from './core/session/index.js';
import { runRepl } from './interface/index.js';

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/** Resolve config or fail loud and early with a non-zero exit. */
function resolveOrExit(projectName: string): SessionConfig {
  try {
    return loadConfig(projectName);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

async function main(): Promise<void> {
  const projectName = process.argv[2];
  if (projectName === undefined || projectName.trim() === '') {
    // Usage mirrors the user-facing launcher verb (scripts/run.mjs start), not `node ...`.
    fail('Usage: run start <project-name>');
  }

  const config = resolveOrExit(projectName);

  // resolveBootModel asks the daemon what is INSTALLED and picks from that (state.json's choice if it's
  // still there → else the smallest installed → else offer to pull the suggestion), rather than trusting
  // a hard-coded default that may not exist locally. It may prompt + pull, so it BLOCKS boot; it returns
  // undefined only if the user declined, which is a valid model-less session (the REPL prints the hint).
  // An unreachable daemon is fatal here for the same reason a missing Docker daemon is: without Ollama a
  // session can do nothing at all, so say so now instead of failing on the user's first message.
  let modelName: string | undefined;
  try {
    modelName = await resolveBootModel();
  } catch (err) {
    fail(`could not reach Ollama: ${err instanceof Error ? err.message : String(err)}`);
  }

  const llm = new OllamaClient({ modelName, numCtx: config.numCtx });
  const sandbox = new SandboxClient({
    containerName: SANDBOX_CONTAINER,
    projectPath: config.projectPath,
  });

  // The launcher (scripts/run.mjs) already did `docker compose up -d`; this attaches (or starts/creates as a fallback).
  // A missing Docker daemon is a fatal boot error, not a recoverable per-turn one.
  try {
    await sandbox.ensureStarted();
  } catch (err) {
    fail(`could not start the sandbox container '${SANDBOX_CONTAINER}': ${err instanceof Error ? err.message : String(err)}`);
  }

  const orchestrator = new SessionOrchestrator(config, llm, sandbox);
  // The launcher's `finally` stops Docker on exit, so we don't stop the sandbox here.
  await runRepl(orchestrator);
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
