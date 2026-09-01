// What a command's complete() receives. Like CommandContext it is owned by no function: it is the
// parameter of an optional METHOD on the Command interface, not of any declaration, and complete-line.ts
// builds one inline while the commands that offer candidates consume it.

import type { ReplOrchestrator } from './run-repl.js';

/** What a command's `complete()` receives to offer Tab candidates for the argument being typed. */
export interface CompletionContext {
  /** The session orchestrator — the source of live candidates (phases, the project path for the backlog). */
  readonly orch: ReplOrchestrator;
  /** The SETTLED args before the word being typed — `['use']` when the cursor sits in `/models use qw⎸`. */
  readonly args: string[];
}
