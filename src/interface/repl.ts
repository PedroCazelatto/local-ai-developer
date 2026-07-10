// The persistent REPL loop: read a line, classify command vs chat message, call the orchestrator,
// and repaint the pinned status line. Streaming output + the spinner are driven by the
// orchestrator's turn loop (task 06); this loop only reads input and renders the shell around it.
//
// Scrollback is preserved: a plain readline interface writes to the normal buffer (no alt-screen).
// The one-time clearScreen() at boot wipes launcher noise; the status bar reserves the bottom row
// (see status-bar.ts) but the conversation and input stay in the scrolling area, copyable as ever.

import { createInterface, type Interface as ReadlineInterface } from 'node:readline/promises';
import path from 'node:path';
import { stdin, stdout } from 'node:process';

import type { Task } from '../core/session/index.js';
import * as renderer from '../core/ui/renderer.js';
import * as statusBar from '../core/ui/status-bar.js';
import { stopThinking } from '../core/ui/spinner.js';
import { newProjectCommand } from './commands/new-project.js';
import { runCommand } from './commands/run.js';

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
  /** Host path to projects/<active> — the /run command reads the backlog from here. */
  readonly projectPath: string;
  /** EXACT combined tokens from the last turn, or null if Ollama didn't report them. */
  readonly lastTurnTokenTotal: number | null;
  /** Run the full turn loop for a chat message (streams output + dispatches tools). */
  processMessage(userInput: string): Promise<void>;
  /** Spawn a fresh Worker window for a backlog task and return its summary (V1/10). */
  runWorkerTask(task: Task, specSlice: string): Promise<string>;
  /** Switch active phase; throws a clear Error on an unknown phase (REPL turns it into a line). */
  switchPhase(name: string): void;
  /** Phase names available for /swap, for the unknown-phase error message. */
  availablePhases(): string[];
}

/** Run the REPL until the user types `/exit` (or EOF). */
export async function runRepl(orch: ReplOrchestrator): Promise<void> {
  renderer.clearScreen(); // one-time: wipe the launcher's boot noise for a clean start
  statusBar.enable(); // reserve the bottom row BEFORE the header so all output scrolls above it
  renderer.header();
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      // Repaint the pinned status line before each prompt: after a turn it carries fresh tokens,
      // after /swap the new phase. It updates in place on the bottom row — never reprinted.
      updateStatus(orch);

      // A failed `rl.question` means stdin is gone (EOF / Ctrl+D / readline closed) — there is no
      // input left to read, so end the session gracefully instead of spinning on a dead stream.
      let line: string;
      try {
        line = (await rl.question('› ')).trim();
      } catch {
        break;
      }
      if (line === '') continue;

      // Any error from a command or a turn is SHOWN and swallowed — one bad turn (a dropped Ollama
      // stream, a tool blowup) must never kill the session. Only genuinely fatal errors that escape
      // to `main().catch` (boot failures, Node runtime faults) end the app, printing to the console.
      try {
        if (line.startsWith('/')) {
          if (await handleCommand(orch, line, rl)) break; // /exit
          continue;
        }
        await orch.processMessage(line);
      } catch (err) {
        stopThinking(); // a spinner may still be running if the turn threw mid-stream
        renderer.errorLine(`✖ ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    stopThinking();
    statusBar.disable(); // release the reserved row and restore normal scrolling
    rl.close();
  }
}

/**
 * Repaint the pinned status line (bottom row, below the input): the full session context —
 * `project · phase · model · exact tokens / num_ctx`. Tokens are the exact last-turn total or `?`.
 */
function updateStatus(orch: ReplOrchestrator): void {
  const tokens = orch.lastTurnTokenTotal === null ? '?' : String(orch.lastTurnTokenTotal);
  statusBar.set(`${orch.project} · ${orch.activePhase} · ${orch.model} · ${tokens}/${orch.numCtx} tok`);
}

/** Yes/no prompt on the existing readline (no clack — avoids fighting readline for stdin). */
async function askYesNo(rl: ReadlineInterface, question: string): Promise<boolean> {
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

/** Dispatch a `/command`. Returns true only for `/exit` (signals the loop to stop). */
async function handleCommand(orch: ReplOrchestrator, input: string, rl: ReadlineInterface): Promise<boolean> {
  const [command, ...rest] = input.slice(1).split(/\s+/);
  switch (command) {
    case 'exit':
      return true;
    case 'run':
      // Execution trigger (V1/10): run backlog tasks sequentially, gating on the user between them.
      await runCommand(rest, orch, (question) => askYesNo(rl, question));
      return false;
    case 'new-project': {
      // A user command, never a model tool — scaffolds a NEW project on disk (the session stays
      // locked to its current project; the user restarts to work on the new one).
      const projectsRoot = path.resolve(process.cwd(), 'projects');
      const outcome = newProjectCommand(rest, projectsRoot);
      if (outcome.ok) {
        renderer.systemMessage(outcome.message);
      } else {
        renderer.errorLine(outcome.message);
      }
      return false;
    }
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
