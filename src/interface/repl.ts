// The persistent REPL loop: read a line, classify command vs chat message, call the
// orchestrator, and print the status line. Streaming output + the spinner are driven by the
// orchestrator's turn loop (task 06); this loop only reads input and renders the shell around it.
//
// Scrollback is preserved because we use a plain readline interface writing to the normal buffer
// (no alt-screen, no clear) — the user can scroll up and copy any prior line.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import * as renderer from '../core/ui/renderer.js';
import { stopThinking } from '../core/ui/spinner.js';

/**
 * What the REPL needs from the orchestrator (task 06's SessionOrchestrator satisfies this
 * structurally). Kept as an interface so this loop builds and reasons independently of 06.
 */
export interface ReplOrchestrator {
  readonly project: string;
  readonly model: string;
  readonly numCtx: number;
  /** Current phase name — drives the status line + assistant prefix. */
  readonly activePhase: string;
  /** EXACT combined tokens from the last turn, or null if Ollama didn't report them. */
  readonly lastTurnTokenTotal: number | null;
  /** Run the full turn loop for a chat message (streams output + dispatches tools). */
  processMessage(userInput: string): Promise<void>;
  /** Switch active phase; throws a clear Error on an unknown phase (REPL turns it into a line). */
  switchPhase(name: string): void;
  /** Phase names available for /swap, for the unknown-phase error message. */
  availablePhases(): string[];
}

/** Run the REPL until the user types `/exit` (or EOF). */
export async function runRepl(orch: ReplOrchestrator): Promise<void> {
  renderer.banner();
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      printStatus(orch);
      const line = (await rl.question('› ')).trim();
      if (line === '') continue;

      if (line.startsWith('/')) {
        if (handleCommand(orch, line)) break; // /exit
        continue;
      }
      await orch.processMessage(line);
    }
  } finally {
    stopThinking();
    rl.close();
  }
}

function printStatus(orch: ReplOrchestrator): void {
  renderer.statusLine({
    project: orch.project,
    phase: orch.activePhase,
    model: orch.model,
    tokens: orch.lastTurnTokenTotal,
    numCtx: orch.numCtx,
  });
}

/** Dispatch a `/command`. Returns true only for `/exit` (signals the loop to stop). */
function handleCommand(orch: ReplOrchestrator, input: string): boolean {
  const [command, ...rest] = input.slice(1).split(/\s+/);
  switch (command) {
    case 'exit':
      return true;
    case 'swap': {
      const target = rest[0];
      if (target === undefined || target === '') {
        renderer.errorLine(`Usage: /swap <phase>. Available: ${orch.availablePhases().join(', ')}`);
        return false;
      }
      try {
        orch.switchPhase(target);
        renderer.systemMessage(`→ phase: ${orch.activePhase}`);
      } catch (err) {
        // Unknown phase (or any switch failure) is recoverable — print, keep the REPL alive.
        renderer.errorLine(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
    default:
      // Shift+Tab phase-cycle and /help are V5; /clear /resume /models are V4/V5. Not here.
      renderer.errorLine(`Unknown command: /${command ?? ''}`);
      return false;
  }
}
