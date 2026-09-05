// The process entry sequence — everything `run start <project>` does between argv and the REPL.
//
// What src/boot/ is, and what it is not. It holds the three functions src/index.ts used to declare,
// split out one per file: this sequence, the config step it calls, and the exit it fails through. It is
// NOT the home of everything with "boot" in its name — resolveBootModel lives in core/session/ with the
// session state it reads, and this folder calls it exactly like any other caller would. The folder owns
// the sequence, not the vocabulary.
//
// The sequence: parse the required <project-name> argv, resolve + validate the session config (02),
// resolve the model against what Ollama actually has installed, ensure the sandbox container is up
// (04), build the orchestrator (06), and hand it to the persistent REPL (05). From there the session
// streams turns with exact token counts, switches phases with isolated histories, and dispatches model
// tool calls into the sandbox — the Foundation bar.
//
// `import 'dotenv/config'` is deliberately NOT here. It must run before any process.env read, so it
// stays the first import of src/index.ts, which ESM evaluates in full before this module's subtree.

import { SANDBOX_CONTAINER, SandboxClient } from '../core/container/index.js';
import { errMessage } from '../core/err-message.js';
import { OllamaClient } from '../core/llm/index.js';
import { SessionOrchestrator, resolveBootModel } from '../core/session/index.js';
import { runRepl } from '../interface/run-repl.js';
import { fail } from './fail.js';
import { resolveOrExit } from './resolve-or-exit.js';

/**
 * Boot a session for the project named in argv and run the REPL until it exits. Every failure along the
 * way is fatal by design: it exits non-zero through fail() rather than throwing back to the caller.
 */
export async function main(): Promise<void> {
  const projectName = process.argv[2];
  if (projectName === undefined || projectName.trim() === '') {
    // Usage mirrors the user-facing launcher verb (scripts/run.mjs start), not `node ...`.
    fail('Usage: run start <project-name>');
  }

  // resolveOrExit loads and validates the session config, exiting non-zero with the reason rather than
  // returning when the project name does not name a real project.
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
    fail(`could not reach Ollama: ${errMessage(err)}`);
  }

  // timeoutMs is the per-call STALL window (OLLAMA_TIMEOUT_MS), not a cap on how long a turn may run —
  // every chunk restarts it, so only a daemon that has gone quiet trips it. See config.ts.
  const llm = new OllamaClient({ modelName, numCtx: config.numCtx, timeoutMs: config.timeoutMs });
  const sandbox = new SandboxClient({
    containerName: SANDBOX_CONTAINER,
    projectPath: config.projectPath,
  });

  // The launcher (scripts/run.mjs) already did `docker compose up -d`; this attaches (or starts/creates as a fallback).
  // A missing Docker daemon is a fatal boot error, not a recoverable per-turn one.
  try {
    await sandbox.ensureStarted();
  } catch (err) {
    fail(`could not start the sandbox container '${SANDBOX_CONTAINER}': ${errMessage(err)}`);
  }

  const orchestrator = new SessionOrchestrator(config, llm, sandbox);
  // The launcher's `finally` stops Docker on exit, so we don't stop the sandbox here.
  try {
    await runRepl(orchestrator);
  } finally {
    // shutdown: commit whatever any phase left buffered and close memory.db (checkpointing its WAL).
    // In a `finally` so a crash in the REPL still commits the turns it had rather than dropping them.
    orchestrator.shutdown();
  }
}
